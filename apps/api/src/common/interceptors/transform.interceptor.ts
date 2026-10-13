import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from "@nestjs/common";
import { map, type Observable } from "rxjs";
import { Decimal } from "../decimal.js";

function convert(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Decimal) return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(convert);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = convert(v);
    return out;
  }
  return value;
}

/** Ubah Decimal Prisma menjadi number agar JSON bersih. */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => (data instanceof StreamableFile ? data : convert(data))),
    );
  }
}
