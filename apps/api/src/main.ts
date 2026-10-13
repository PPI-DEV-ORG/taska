import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module.js";

function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const copy = { ...(body as Record<string, unknown>) };
  for (const key of Object.keys(copy)) {
    if (/password|token|secret/i.test(key)) copy[key] = "***";
  }
  return copy;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  const httpLogger = new Logger("HTTP");

  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const { method, originalUrl } = req;

    res.on("finish", () => {
      const ms = Date.now() - start;
      const status = res.statusCode;
      const hasBody = req.body && typeof req.body === "object" && Object.keys(req.body).length > 0;
      const bodyStr = hasBody ? ` body=${JSON.stringify(sanitizeBody(req.body))}` : "";
      const line = `${method} ${originalUrl} -> ${status} (${ms}ms)${bodyStr}`;
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
  app.enableCors({ origin: true, credentials: true });
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
  httpLogger.log(`Taska API berjalan di http://localhost:${port}/api`);
}

await bootstrap();

