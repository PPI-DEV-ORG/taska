import {
  Injectable,
  Logger,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

type RateEntry = { count: number; firstAt: number };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly attempts = new Map<string, RateEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private ttlMs(ttl: string): number {
    const m = /^(\d+)\s*(s|m|h|d)?$/.exec(ttl.trim());
    if (!m) return 7 * 24 * 3600 * 1000;
    const n = Number(m[1]);
    const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2] ?? "h"] ?? 3600000;
    return n * unit;
  }

  private hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private checkRate(key: string) {
    const now = Date.now();
    const entry = this.attempts.get(key);
    if (!entry || now - entry.firstAt > WINDOW_MS) {
      this.attempts.set(key, { count: 1, firstAt: now });
      return;
    }
    entry.count += 1;
    if (entry.count > MAX_ATTEMPTS) {
      throw new HttpException(
        "Terlalu banyak percobaan login. Coba lagi dalam 15 menit",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private fail(key: string) {
    const entry = this.attempts.get(key);
    if (!entry) this.attempts.set(key, { count: 1, firstAt: Date.now() });
  }

  private clearRate(key: string) {
    this.attempts.delete(key);
  }

  private async issueTokens(user: { id: number; email: string; name: string; role: string }) {
    const accessTtl = this.config.get<string>("JWT_ACCESS_TTL") ?? "12h";
    const refreshTtl = this.config.get<string>("JWT_REFRESH_TTL") ?? "7d";

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, name: user.name, role: user.role },
      { expiresIn: accessTtl as JwtSignOptions["expiresIn"] },
    );

    const refreshToken = randomBytes(48).toString("hex");
    await this.prisma.main.refreshToken.create({
      data: {
        tokenHash: this.hash(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + this.ttlMs(refreshTtl)),
      },
    });

    return { accessToken, refreshToken };
  }

  async login(email: string, password: string, meta: { ip?: string; userAgent?: string }) {
    const key = `${email}|${meta.ip ?? "-"}`;
    this.checkRate(key);

    const user = await this.prisma.main.user.findUnique({ where: { email } });
    const ok = user && user.status === "AKTIF" && (await bcrypt.compare(password, user.passwordHash));

    if (!ok) {
      this.fail(key);
      throw new UnauthorizedException("Email atau password salah");
    }
    this.clearRate(key);

    const tokens = await this.issueTokens(user);
    await this.prisma.main.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log({
      actor: { id: user.id, email: user.email, name: user.name, role: user.role },
      action: "LOGIN",
      entityType: "user",
      entityId: user.id,
    });

    const { passwordHash: _ignored, ...safe } = user;
    return { ...tokens, user: { ...safe, lastLoginAt: new Date() } };
  }

  async refresh(rawToken: string, _meta: { ip?: string; userAgent?: string }) {
    const tokenHash = this.hash(rawToken);
    const stored = await this.prisma.main.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Sesi berakhir. Silakan login ulang");
    }
    if (stored.user.status !== "AKTIF") {
      throw new UnauthorizedException("Akun tidak aktif");
    }

    // rotasi: token lama dicabut, token baru diterbitkan
    await this.prisma.main.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(stored.user);
    return { ...tokens, user: { id: stored.user.id, email: stored.user.email, name: stored.user.name, role: stored.user.role } };
  }

  async logout(rawToken: string, meta: { ip?: string; userAgent?: string }) {
    const tokenHash = this.hash(rawToken);
    const stored = await this.prisma.main.refreshToken.findUnique({ where: { tokenHash } });
    if (stored && !stored.revokedAt) {
      await this.prisma.main.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date(), ip: meta.ip, userAgent: meta.userAgent },
      });
    }
    return { ok: true };
  }

  async me(user: RequestUser) {
    const row = await this.prisma.main.user.findUnique({
      where: { id: user.id },
      select: {
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
      },
    });
    if (!row) throw new UnauthorizedException();
    return row;
  }

  /** Bersihkan entri rate limit (untuk test). */
  resetRateLimit() {
    this.attempts.clear();
  }
}
