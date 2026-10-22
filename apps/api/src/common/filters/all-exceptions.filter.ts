import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import { Prisma } from "../../generated/prisma/client.js";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const route = `${req.method} ${req.originalUrl}`;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const detail = typeof body === "string" ? body : JSON.stringify(body);
      if (status >= 500) {
        this.logger.error(`[${status}] ${route} — ${detail}`, exception.stack);
      } else if (status === 429) {
        this.logger.warn(`[429 Throttle] ${route} — ${detail}`);
      } else {
        this.logger.warn(`[${status}] ${route} — ${detail}`);
      }
      return res.status(status).json(typeof body === "string" ? { statusCode: status, message: body } : body);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const map: Record<string, { status: number; message: string }> = {
        P2002: { status: 409, message: "Data sudah ada (duplikat)" },
        P2025: { status: 404, message: "Data tidak ditemukan" },
        P2003: { status: 409, message: "Relasi data tidak valid" },
        P2007: { status: 409, message: "Operasi database gagal" },
      };
      const mapped = map[exception.code] ?? { status: 400, message: `Database error ${exception.code}` };
      this.logger.error(
        `[Prisma ${exception.code}] ${route} — ${exception.message} meta=${JSON.stringify(exception.meta ?? {})}`,
      );
      return res.status(mapped.status).json({ statusCode: mapped.status, message: mapped.message, code: exception.code });
    }

    const message = exception instanceof Error ? exception.message : "Terjadi kesalahan";
    this.logger.error(`[500] ${route} — ${message}`, exception instanceof Error ? exception.stack : "");

    if (res.headersSent) {
      return;
    }

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Terjadi kesalahan pada server",
    });
  }
}
