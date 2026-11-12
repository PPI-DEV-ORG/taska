import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters?: { isCash?: boolean; isPostable?: boolean; category?: string; search?: string }) {
    const where: any = {};
    if (filters?.isCash !== undefined) where.isCash = filters.isCash;
    if (filters?.isPostable !== undefined) where.isPostable = filters.isPostable;
    if (filters?.category) where.category = filters.category;
    if (filters?.search) {
      where.OR = [
        { code: { contains: filters.search } },
        { name: { contains: filters.search } },
      ];
    }
    return (this.prisma.main as any).coaAccount.findMany({
      where,
      orderBy: { code: "asc" },
    });
  }

  async getByCode(code: string) {
    const acc = await (this.prisma.main as any).coaAccount.findUnique({
      where: { code },
    });
    if (!acc) throw new NotFoundException(`Akun dengan kode ${code} tidak ditemukan.`);
    return acc;
  }

  async create(data: {
    code: string;
    name: string;
    category: string;
    normalBalance: "DEBIT" | "KREDIT";
    parentCode?: string;
    isPostable?: boolean;
    isCash?: boolean;
  }) {
    const existing = await (this.prisma.main as any).coaAccount.findUnique({
      where: { code: data.code },
    });
    if (existing) throw new BadRequestException(`Kode akun ${data.code} sudah digunakan.`);

    return (this.prisma.main as any).coaAccount.create({
      data: {
        code: data.code,
        name: data.name,
        category: data.category,
        normalBalance: data.normalBalance,
        parentCode: data.parentCode || null,
        isPostable: data.isPostable ?? true,
        isCash: data.isCash ?? false,
        isSystem: false,
        status: "AKTIF",
      },
    });
  }

  async update(code: string, data: Partial<{
    name: string;
    category: string;
    normalBalance: "DEBIT" | "KREDIT";
    parentCode: string | null;
    isPostable: boolean;
    isCash: boolean;
    status: string;
  }>) {
    const existing = await this.getByCode(code);
    if (existing.isSystem && data.isPostable === false && existing.isPostable === true) {
      throw new BadRequestException("Akun sistem utama tidak dapat diubah menjadi non-postable.");
    }
    return (this.prisma.main as any).coaAccount.update({
      where: { code },
      data,
    });
  }
}
