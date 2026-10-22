import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request, Response } from "express";
import { SKIP_THROTTLE_KEY } from "../decorators/skip-throttle.decorator.js";

/**
 * ThrottleGuard: membatasi lonjakan request (burst) maksimal 20 request beruntun per endpoint.
 * - Memungkinkan browser/aplikasi memuat 20+ data berbeda sekaligus saat refresh tanpa terblokir.
 * - Mencegah infinite loop atau spam berulang ke endpoint yang sama (maksimal 20 req/detik per endpoint).
 * - Menyediakan batas pengaman global 100 req/detik per IP untuk perlindungan server.
 */
@Injectable()
export class ThrottleGuard implements CanActivate {
  private readonly logger = new Logger(ThrottleGuard.name);
  private readonly windowMs = 1000;
  private readonly endpointLimit = 20; // Batas 20 request beruntun ke endpoint yang sama
  private readonly globalLimit = 100; // Pengaman global bila ada script spam masif
  private readonly hits = new Map<string, number[]>();
  private lastCleanup = Date.now();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== "http") return true;

    const isSkipped = this.reflector.getAllAndOverride<boolean>(SKIP_THROTTLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isSkipped) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    // Skip root & health check
    if (req.path === "/" || req.path === "/api" || req.path === "/api/health") {
      return true;
    }

    const now = Date.now();

    // Pembersihan entri lama setiap 30 detik
    if (now - this.lastCleanup > 30000) {
      this.lastCleanup = now;
      for (const [key, timestamps] of this.hits.entries()) {
        const fresh = timestamps.filter((t) => now - t < this.windowMs);
        if (fresh.length === 0) {
          this.hits.delete(key);
        } else {
          this.hits.set(key, fresh);
        }
      }
    }

    // Identifikasi unik per klien: token auth atau IP
    const authHeader = req.headers.authorization;
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "127.0.0.1";
    const clientKey = authHeader ? `t:${authHeader.slice(-24)}` : `ip:${ip}`;

    // 1. Cek batas global (100 req/detik)
    const globalTimestamps = (this.hits.get(clientKey) ?? []).filter((t) => now - t < this.windowMs);
    if (globalTimestamps.length >= this.globalLimit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: "Batas traffic global terlampaui. Silakan tunggu sesaat.",
          error: "Too Many Requests",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    globalTimestamps.push(now);
    this.hits.set(clientKey, globalTimestamps);

    // 2. Cek batas per endpoint (maks 20 request beruntun ke endpoint yang sama)
    const endpointKey = `${clientKey}:${req.method}:${req.path}`;
    const endpointTimestamps = (this.hits.get(endpointKey) ?? []).filter((t) => now - t < this.windowMs);

    if (endpointTimestamps.length >= this.endpointLimit) {
      const oldest = endpointTimestamps[0] ?? now;
      const retryAfterSec = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));

      res.setHeader("Retry-After", String(retryAfterSec));
      res.setHeader("X-RateLimit-Limit", String(this.endpointLimit));
      res.setHeader("X-RateLimit-Remaining", "0");

      this.logger.warn(`[429 RateLimit] Client ${clientKey} loop ${endpointKey} > 20 req/detik`);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Batas 20 request beruntun ke ${req.method} ${req.path} terlampaui. Silakan tunggu sesaat.`,
          error: "Too Many Requests",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    endpointTimestamps.push(now);
    this.hits.set(endpointKey, endpointTimestamps);

    res.setHeader("X-RateLimit-Limit", String(this.endpointLimit));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, this.endpointLimit - endpointTimestamps.length)));

    return true;
  }
}
