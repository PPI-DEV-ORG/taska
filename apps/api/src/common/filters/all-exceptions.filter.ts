import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Response } from "express";
import { Prisma } from "../../generated/prisma/client.js";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
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
      return res.status(mapped.status).json({ statusCode: mapped.status, message: mapped.message, code: exception.code });
    }

    const message = exception instanceof Error ? exception.message : "Terjadi kesalahan";
    if (!(exception instanceof Error) || !["TypeError", "RangeError"].includes(exception.name)) {
      this.logger.error(message, exception instanceof Error ? exception.stack : "");
    } else {
      this.logger.error(message);
    }
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Terjadi kesalahan pada server",
    });
  }
}
