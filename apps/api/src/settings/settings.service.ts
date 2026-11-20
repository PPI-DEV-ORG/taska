import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { getDynamicRoles, setDynamicRoles, type RoleDefinition } from "../rbac/permissions.js";
import { ROLE_MATRIX_VERSION, STANDARD_ROLES } from "../rbac/role-matrix.js";

export const DEFAULTS: Record<string, string> = {
  "ambang.persetujuan": "100000000000",
  "ppn.persen": "11",
  "upload.maksimal.foto": "5242880",
  "upload.maksimal.dokumen": "15728640",
  "upload.maksimal.video": "26214400",
  // Profil Perusahaan Default
  "company.name": "PT Samudera Teknologi Solusi",
  "company.address": "Jl. Jenderal Sudirman No. 88, Jakarta Selatan",
  "company.phone": "021-555-0199",
  "company.email": "info@samtek.co.id",
  "company.website": "www.samtek.co.id",
  "company.npwp": "01.234.567.8-901.000",
  "company.bank_name": "BCA",
  "company.bank_account": "1234567890",
  "company.bank_holder": "PT Samudera Teknologi Solusi",
  "company.signatory_name": "Direktur Utama",
  "company.signatory_title": "Direktur",
  "company.logo_file_id": "",
  "company.stamp_file_id": "",
  "company.tagline": "",
  "company.city": "",
  /** Gambar kop surat penuh (opsional) — bila diisi, dipakai sebagai kepala dokumen cetak. */
  "company.letterhead_file_id": "",
  /** Syarat & ketentuan bawaan yang tercetak di setiap PO ke supplier. */
  "company.po_terms": "",
  // Format Nomor Dokumen Default
  "nomor.penawaran": "PNW/YYYY/MM/NNN",
  "nomor.clientPO": "SO/YYYY/MM/NNN",
  "nomor.permintaan": "PNJ/YYYY/MM/NNN",
  "nomor.pesanan": "PO/YYYY/MM/NNN",
  "nomor.suratJalan": "SJN/YYYY/MM/NNN",
  "nomor.penerimaan": "RCP/YYYY/MM/NNN",
  "nomor.pelanggan": "INV/YYYY/MM/NNN",
  "nomor.supplier": "RNC/YYYY/MM/NNN",
  "nomor.proyek": "PRJ/YYYY/NNN",
};

export interface CompanyProfile {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  npwp: string;
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  signatoryName: string;
  signatoryTitle: string;
  logoFileId: string;
  stampFileId: string;
  tagline: string;
  city: string;
  letterheadFileId: string;
  poTerms: string;
}

@Injectable()
export class SettingsService implements OnModuleInit, OnModuleDestroy {
  private readonly cache = new Map<string, { value: string; expiresAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  private rolesTimer?: ReturnType<typeof setInterval>;

  async onModuleInit() {
    await this.reloadRoles();
    await this.upgradeRoleMatrix();
    // Matriks RBAC disimpan di DB tapi dicek dari memori (guard sinkron). Muat ulang berkala agar
    // perubahan dari instance/proses lain juga berlaku tanpa restart server.
    this.rolesTimer = setInterval(() => void this.reloadRoles(), 30_000);
    this.rolesTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.rolesTimer) clearInterval(this.rolesTimer);
  }

  /**
   * Migrasi data hak akses: bila versi matriks di database lebih lama dari ROLE_MATRIX_VERSION,
   * peran BAWAAN diset ulang ke matriks standar (peran kustom tidak disentuh), lalu versinya dicatat.
   * Berjalan sekali per versi — seperti migration, tapi untuk JSON hak akses di SystemSetting "rbac.roles".
   */
  async upgradeRoleMatrix(): Promise<void> {
    try {
      const verRow = await this.prisma.main.systemSetting.findUnique({ where: { key: "rbac.matrixVersion" } });
      const current = Number(verRow?.value ?? 0);
      if (current >= ROLE_MATRIX_VERSION) return;
      const rolesRow = await this.prisma.main.systemSetting.findUnique({ where: { key: "rbac.roles" } });
      if (rolesRow?.value) {
        const existingCodes = new Set(getDynamicRoles().map((r) => r.code));
        const next = getDynamicRoles().map((r) => {
          const std = STANDARD_ROLES[r.code];
          return std ? { ...r, name: std.name, description: std.description, isSystem: true, permissions: { ...std.permissions } } : r;
        });
        for (const [code, std] of Object.entries(STANDARD_ROLES)) {
          if (!existingCodes.has(code)) {
            next.push({ code, name: std.name, description: std.description, isSystem: true, permissions: { ...std.permissions } });
          }
        }
        setDynamicRoles(next);
        await this.prisma.main.systemSetting.update({
          where: { key: "rbac.roles" },
          data: { value: JSON.stringify(getDynamicRoles()) },
        });
      }
      await this.prisma.main.systemSetting.upsert({
        where: { key: "rbac.matrixVersion" },
        create: { key: "rbac.matrixVersion", value: String(ROLE_MATRIX_VERSION), description: "Versi matriks hak akses standar yang sudah diterapkan" },
        update: { value: String(ROLE_MATRIX_VERSION) },
      });
      this.cache.delete("rbac.roles");
      console.log(`Matriks hak akses peran bawaan diperbarui ke v${ROLE_MATRIX_VERSION}`);
    } catch (e) {
      console.warn("Gagal memperbarui matriks hak akses:", (e as Error).message);
    }
  }

  /** Muat matriks peran dari DB ke memori. */
  async reloadRoles(): Promise<void> {
    try {
      const row = await this.prisma.main.systemSetting.findUnique({ where: { key: "rbac.roles" } });
      if (row?.value) {
        const parsed = JSON.parse(row.value);
        if (Array.isArray(parsed)) {
          setDynamicRoles(parsed);
        }
      }
    } catch (e) {
      console.warn("Gagal memuat matriks peran (RBAC) dari database:", (e as Error).message);
    }
  }

  async getValue(key: string): Promise<string> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const row = await this.prisma.main.systemSetting.findUnique({ where: { key } });
    const val = row ? row.value : (key in DEFAULTS ? DEFAULTS[key] : null);
    if (val !== null && val !== undefined) {
      this.cache.set(key, { value: val, expiresAt: Date.now() + 60000 });
      return val;
    }
    throw new NotFoundException(`Pengaturan ${key} tidak ditemukan`);
  }

  async getNumber(key: string): Promise<number> {
    const raw = await this.getValue(key);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  /** Ambang persetujuan lapis kedua (Bos) — Rp, dari pengaturan. */
  threshold(): Promise<number> {
    return this.getNumber("ambang.persetujuan");
  }

  ppn(): Promise<number> {
    return this.getNumber("ppn.persen");
  }

  async list() {
    const rows = await this.prisma.main.systemSetting.findMany({ orderBy: { key: "asc" } });
    const known = new Set(rows.map((r) => r.key));
    const defaults = Object.entries(DEFAULTS)
      .filter(([k]) => !known.has(k))
      .map(([key, value]) => ({ key, value, description: null, updatedById: null }));
    return [...rows, ...defaults];
  }

  async set(key: string, value: string, user: RequestUser, description?: string) {
    this.cache.delete(key);
    return this.prisma.main.systemSetting.upsert({
      where: { key },
      update: {
        value,
        updatedById: user.id,
        ...(description !== undefined ? { description } : {}),
      },
      create: {
        key,
        value,
        updatedById: user.id,
        ...(description !== undefined ? { description } : {}),
      },
    });
  }

  private async getSafe(key: string): Promise<string> {
    try {
      return await this.getValue(key);
    } catch {
      return DEFAULTS[key] ?? "";
    }
  }

  async getCompanyProfile(): Promise<CompanyProfile> {
    const [
      name,
      address,
      phone,
      email,
      website,
      npwp,
      bankName,
      bankAccount,
      bankHolder,
      signatoryName,
      signatoryTitle,
      logoFileId,
      stampFileId,
      tagline,
      city,
      letterheadFileId,
      poTerms,
    ] = await Promise.all([
      this.getSafe("company.name"),
      this.getSafe("company.address"),
      this.getSafe("company.phone"),
      this.getSafe("company.email"),
      this.getSafe("company.website"),
      this.getSafe("company.npwp"),
      this.getSafe("company.bank_name"),
      this.getSafe("company.bank_account"),
      this.getSafe("company.bank_holder"),
      this.getSafe("company.signatory_name"),
      this.getSafe("company.signatory_title"),
      this.getSafe("company.logo_file_id"),
      this.getSafe("company.stamp_file_id"),
      this.getSafe("company.tagline"),
      this.getSafe("company.city"),
      this.getSafe("company.letterhead_file_id"),
      this.getSafe("company.po_terms"),
    ]);
    return {
      name,
      address,
      phone,
      email,
      website,
      npwp,
      bankName,
      bankAccount,
      bankHolder,
      signatoryName,
      signatoryTitle,
      logoFileId,
      stampFileId,
      tagline,
      city,
      letterheadFileId,
      poTerms,
    };
  }

  async updateCompanyProfile(dto: Partial<CompanyProfile>, user: RequestUser): Promise<CompanyProfile> {
    const map: Array<[keyof CompanyProfile, string]> = [
      ["name", "company.name"],
      ["address", "company.address"],
      ["phone", "company.phone"],
      ["email", "company.email"],
      ["website", "company.website"],
      ["npwp", "company.npwp"],
      ["bankName", "company.bank_name"],
      ["bankAccount", "company.bank_account"],
      ["bankHolder", "company.bank_holder"],
      ["signatoryName", "company.signatory_name"],
      ["signatoryTitle", "company.signatory_title"],
      ["logoFileId", "company.logo_file_id"],
      ["stampFileId", "company.stamp_file_id"],
      ["tagline", "company.tagline"],
      ["city", "company.city"],
      ["letterheadFileId", "company.letterhead_file_id"],
      ["poTerms", "company.po_terms"],
    ];
    for (const [prop, key] of map) {
      if (dto[prop] !== undefined) {
        await this.set(key, String(dto[prop] ?? ""), user, `Profil Perusahaan: ${prop}`);
      }
    }
    return this.getCompanyProfile();
  }

  async getDocFormats(): Promise<Record<string, string>> {
    const keys = [
      "nomor.penawaran",
      "nomor.clientPO",
      "nomor.permintaan",
      "nomor.pesanan",
      "nomor.suratJalan",
      "nomor.penerimaan",
      "nomor.pelanggan",
      "nomor.supplier",
      "nomor.proyek",
    ];
    const result: Record<string, string> = {};
    for (const k of keys) {
      result[k] = await this.getSafe(k);
    }
    return result;
  }

  async updateDocFormats(formats: Record<string, string>, user: RequestUser): Promise<Record<string, string>> {
    for (const [key, val] of Object.entries(formats || {})) {
      if (key.startsWith("nomor.") && typeof val === "string" && val.trim()) {
        await this.set(key, val.trim(), user, `Format penomoran dokumen ${key}`);
      }
    }
    return this.getDocFormats();
  }

  async getRoles(): Promise<RoleDefinition[]> {
    await this.reloadRoles();
    return getDynamicRoles();
  }

  async saveRole(role: RoleDefinition, user: RequestUser, opts: { isNew?: boolean } = {}): Promise<RoleDefinition[]> {
    if (!role || !role.code || !role.name) {
      throw new BadRequestException("Kode dan Nama Peran wajib diisi");
    }
    const normCode = String(role.code).toUpperCase().trim().replace(/[\s\-]+/g, "_");
    if (!/^[A-Z0-9_]+$/.test(normCode)) {
      throw new BadRequestException("Kode peran hanya boleh huruf, angka, dan garis bawah");
    }
    if (normCode === "SUPER_ADMIN" || normCode === "SUPERADMIN") {
      throw new BadRequestException("Peran Super Admin selalu memiliki akses penuh dan tidak bisa diubah");
    }
    // Pastikan memakai versi terbaru dari DB sebelum menimpa (hindari menimpa perubahan orang lain)
    await this.reloadRoles();
    const current = getDynamicRoles();
    const idx = current.findIndex((r) => r.code === normCode);
    if (opts.isNew && idx >= 0) {
      throw new BadRequestException(`Kode peran ${normCode} sudah dipakai. Gunakan kode lain.`);
    }
    const updated = [...current];
    if (idx >= 0) {
      updated[idx] = {
        ...updated[idx]!,
        name: role.name.trim(),
        description: role.description ?? updated[idx]!.description,
        permissions: role.permissions && typeof role.permissions === "object" ? role.permissions : updated[idx]!.permissions,
      };
    } else {
      updated.push({
        code: normCode,
        name: role.name.trim(),
        description: role.description ?? "",
        isSystem: false,
        permissions: role.permissions || {},
      });
    }
    setDynamicRoles(updated);
    const nextRoles = getDynamicRoles();
    await this.set("rbac.roles", JSON.stringify(nextRoles), user, "Matriks Peran & Hak Akses (RBAC)");
    return nextRoles;
  }

  /**
   * Terapkan matriks hak akses standar (role-matrix.ts) ke peran bawaan.
   * Peran yang sudah pernah disimpan di DB tidak ikut berubah otomatis saat matriks diperbarui,
   * jadi admin menerapkannya lewat sini (semua peran bawaan, atau kode tertentu). Peran kustom tidak disentuh.
   */
  async applyStandardRoles(codes: string[] | undefined, user: RequestUser): Promise<RoleDefinition[]> {
    await this.reloadRoles();
    const wanted = codes?.length
      ? new Set(codes.map((c) => String(c).toUpperCase().trim().replace(/[\s\-]+/g, "_")))
      : null;
    const existingCodes = new Set(getDynamicRoles().map((r) => r.code));
    const next = getDynamicRoles().map((r) => {
      const std = STANDARD_ROLES[r.code];
      if (!std || (wanted && !wanted.has(r.code))) return r;
      return { ...r, name: std.name, description: std.description, isSystem: true, permissions: { ...std.permissions } };
    });
    for (const [code, std] of Object.entries(STANDARD_ROLES)) {
      if ((!wanted || wanted.has(code)) && !existingCodes.has(code)) {
        next.push({ code, name: std.name, description: std.description, isSystem: true, permissions: { ...std.permissions } });
      }
    }
    setDynamicRoles(next);
    const nextRoles = getDynamicRoles();
    await this.set("rbac.roles", JSON.stringify(nextRoles), user, `Matriks Peran & Hak Akses (RBAC) — standar v${ROLE_MATRIX_VERSION}`);
    return nextRoles;
  }

  async deleteRole(code: string, user: RequestUser): Promise<RoleDefinition[]> {
    const normCode = String(code || "").toUpperCase().trim().replace(/[\s\-]+/g, "_");
    const current = getDynamicRoles();
    const target = current.find((r) => r.code === normCode);
    if (!target) {
      throw new NotFoundException(`Peran ${normCode} tidak ditemukan`);
    }
    if (target.isSystem) {
      throw new BadRequestException("Peran bawaan sistem tidak dapat dihapus (namun hak aksesnya dapat disesuaikan)");
    }
    // Kolom User.role berupa VARCHAR (role kustom), sedangkan Prisma memvalidasi enum -> pakai query mentah.
    const usedRows = await this.prisma.main
      .$queryRaw<Array<{ c: bigint | number }>>`SELECT COUNT(*) AS c FROM \`User\` WHERE \`role\` = ${normCode}`
      .catch(() => [{ c: 0 }]);
    const usedBy = Number(usedRows[0]?.c ?? 0);
    if (usedBy > 0) {
      throw new BadRequestException(`Peran ini masih dipakai ${usedBy} pengguna. Pindahkan pengguna ke peran lain dulu.`);
    }
    const next = current.filter((r) => r.code !== normCode);
    setDynamicRoles(next);
    const nextRoles = getDynamicRoles();
    await this.set("rbac.roles", JSON.stringify(nextRoles), user, "Matriks Peran & Hak Akses (RBAC)");
    return nextRoles;
  }
}
