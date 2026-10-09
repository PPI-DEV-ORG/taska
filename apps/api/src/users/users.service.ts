import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service.js";
import { PageQuery, paginate } from "../common/dto/page-query.js";
import { CreateUserDto, UpdateUserDto } from "./dto/user.dto.js";

const SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  position: true,
  department: true,
  role: true,
  status: true,
  warehouseId: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: PageQuery & { role?: string; status?: string }) {
    const where = {
      ...(q.role ? { role: q.role as never } : {}),
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q } },
              { email: { contains: q.q } },
              { department: { contains: q.q } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.main.user.findMany({
        where,
        select: SELECT,
        orderBy: { name: "asc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.main.user.count({ where }),
    ]);
    return paginate(items, total, q);
  }

  /** Opsi anggota tim (divisi) — minim, tanpa data sensitif. */
  options(role?: string) {
    return this.prisma.main.user.findMany({
      where: { status: "AKTIF", ...(role ? { role: role as never } : {}) },
      select: { id: true, name: true, role: true, position: true, department: true },
      orderBy: { name: "asc" },
    });
  }

  async get(id: number) {
    const user = await this.prisma.main.user.findUnique({ where: { id }, select: SELECT });
    if (!user) throw new NotFoundException("Pengguna tidak ditemukan");
    return user;
  }

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.main.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException("Email sudah terdaftar");
    const { password, ...data } = dto;
    return this.prisma.main.user.create({
      data: { ...data, passwordHash: await bcrypt.hash(password, 10) },
      select: SELECT,
    });
  }

  async update(id: number, dto: UpdateUserDto) {
    await this.get(id);
    const { password, warehouseId, ...rest } = dto;
    return this.prisma.main.user.update({
      where: { id },
      data: {
        ...rest,
        ...(warehouseId !== undefined ? { warehouseId } : {}),
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      },
      select: SELECT,
    });
  }
}
