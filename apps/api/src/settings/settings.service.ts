import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";

export const DEFAULTS: Record<string, string> = {
  "ambang.persetujuan": "10000000",
  "ppn.persen": "11",
  "upload.maksimal.foto": "5242880",
  "upload.maksimal.dokumen": "15728640",
  "upload.maksimal.video": "26214400",
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getValue(key: string): Promise<string> {
    const row = await this.prisma.main.systemSetting.findUnique({ where: { key } });
    if (row) return row.value;
    if (key in DEFAULTS) return DEFAULTS[key];
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

  async set(key: string, value: string, user: RequestUser) {
    return this.prisma.main.systemSetting.upsert({
      where: { key },
      update: { value, updatedById: user.id },
      create: { key, value, updatedById: user.id },
    });
  }
}
