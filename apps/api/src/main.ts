import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module.js";

const SENSITIVE_KEY_RE = /password|token|secret|apikey|api_key|authorization/i;

function sanitizeBody(body: unknown, depth = 0): unknown {
  if (depth > 5 || !body || typeof body !== "object") return body;
  if (Array.isArray(body)) return body.map((item) => sanitizeBody(item, depth + 1));
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    copy[key] = SENSITIVE_KEY_RE.test(key) ? "***" : sanitizeBody(value, depth + 1);
  }
  return copy;
}

function sanitizeUrlForLog(rawUrl: string): string {
  return rawUrl.replace(/([?&])(access_token|token|password|api_key)=[^&]*/gi, "$1$2=***");
}

function buildCorsOriginValidator() {
  const configured = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Izinkan request non-browser (mobile native RN, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (configured.length > 0) {
      return callback(null, configured.includes(origin));
    }
    try {
      const { hostname } = new URL(origin);
      const allowed =
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname.endsWith(".ghinamultiprima.co.id") ||
        hostname === "ghinamultiprima.co.id" ||
        /^192\.168\.\d+\.\d+$/.test(hostname) ||
        /^10\.\d+\.\d+\.\d+$/.test(hostname);
      return callback(null, allowed);
    } catch {
      return callback(null, false);
    }
  };
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  const httpLogger = new Logger("HTTP");

  app.use(
    helmet({
      // Izinkan frontend beda origin/port memuat <img> preview dokumen/foto dari API
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false,
    }),
  );

  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const { method, originalUrl } = req;

    res.on("finish", () => {
      const ms = Date.now() - start;
      const status = res.statusCode;
      const hasBody = req.body && typeof req.body === "object" && Object.keys(req.body).length > 0;
      const bodyStr = hasBody ? ` body=${JSON.stringify(sanitizeBody(req.body))}` : "";
      const safeUrl = sanitizeUrlForLog(originalUrl);
      const line = `${method} ${safeUrl} -> ${status} (${ms}ms)${bodyStr}`;
      if (status >= 500) {
        httpLogger.error(line);
      } else if (status >= 400) {
        httpLogger.warn(line);
      } else {
        httpLogger.log(line);
      }
    });

    next();
  });

  app.setGlobalPrefix("api");
  app.enableCors({ origin: buildCorsOriginValidator(), credentials: true });
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, "0.0.0.0");
  httpLogger.log(`Akuntra API berjalan di http://localhost:${port}/api`);
}

await bootstrap();

