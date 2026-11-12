import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class MappingService {
  private cache = new Map<string, string>();
  private cacheExpiry = 0;

  constructor(private readonly prisma: PrismaService) {}

  private async refreshCache(): Promise<void> {
    const mappings = await (this.prisma.main as any).accountMapping.findMany();
    this.cache.clear();
    for (const m of mappings) {
      this.cache.set(m.key, m.accountCode);
    }
    this.cacheExpiry = Date.now() + 60_000;
  }

  async get(key: string, defaultCode?: string): Promise<string> {
    if (Date.now() > this.cacheExpiry || this.cache.size === 0) {
      await this.refreshCache();
    }
    const val = this.cache.get(key);
    if (val) return val;
    if (defaultCode) return defaultCode;
    throw new Error(`Account mapping key "${key}" is not configured.`);
  }

  async getAll(): Promise<Record<string, string>> {
    if (Date.now() > this.cacheExpiry || this.cache.size === 0) {
      await this.refreshCache();
    }
    const res: Record<string, string> = {};
    for (const [k, v] of this.cache.entries()) {
      res[k] = v;
    }
    return res;
  }

  async set(key: string, accountCode: string): Promise<void> {
    await (this.prisma.main as any).accountMapping.upsert({
      where: { key },
      update: { accountCode },
      create: { key, accountCode },
    });
    this.cache.set(key, accountCode);
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheExpiry = 0;
  }
}
