import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service.js";

export type JwtPayload = {
  sub: number;
  email: string;
  name: string;
  role: string;
};

const QUERY_TOKEN_PATH_RE =
  /^\/api\/(files\/\d+|invoices\/\d+\/(excel|pdf)|invoices-out\/\d+\/(excel|pdf)|quotations\/(\d+\/(excel|pdf)|template-(excel|pdf)))(\?|$)/;

function extractQueryTokenForDownload(req: Request): string | null {
  if (!req || req.method !== "GET") return null;
  const url = req.originalUrl || req.url || "";
  if (!QUERY_TOKEN_PATH_RE.test(url)) return null;
  const raw = req.query?.access_token;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  private readonly statusCache = new Map<number, { active: boolean; role: string; expiresAt: number }>();

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractQueryTokenForDownload,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_SECRET"),
    });
  }

  async validate(payload: JwtPayload) {
    const now = Date.now();
    const cached = this.statusCache.get(payload.sub);
    if (cached && cached.expiresAt > now) {
      if (!cached.active) {
        throw new UnauthorizedException("Akun tidak aktif atau telah dinonaktifkan.");
      }
      return { id: payload.sub, email: payload.email, name: payload.name, role: cached.role };
    }

    const user = await this.prisma.main.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, status: true, role: true },
    });
    const active = Boolean(user && user.status === "AKTIF");
    const role = user?.role ?? payload.role;
    this.statusCache.set(payload.sub, { active, role, expiresAt: now + 30_000 });
    if (this.statusCache.size > 500) {
      for (const [k, v] of this.statusCache) {
        if (v.expiresAt <= now) this.statusCache.delete(k);
      }
    }
    if (!active) {
      throw new UnauthorizedException("Akun tidak aktif atau telah dinonaktifkan.");
    }
    return { id: payload.sub, email: payload.email, name: payload.name, role };
  }
}
