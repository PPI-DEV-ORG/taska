import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from "@nestjs/common";
import { map, type Observable } from "rxjs";
import { Decimal } from "../decimal.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function convert(value: unknown, seen = new WeakSet()): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Decimal) return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === "object") {
    if (seen.has(value as object)) return undefined;
    seen.add(value as object);
    if (Array.isArray(value)) return value.map((item) => convert(item, seen));
    if (!isPlainObject(value)) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = convert(v, seen);
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
