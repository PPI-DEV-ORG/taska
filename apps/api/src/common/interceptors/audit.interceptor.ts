import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { AuditService } from "../../audit/audit.service.js";
import type { RequestUser } from "../decorators/current-user.decorator.js";

const MUTATIONS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SKIP = new Set(["/api/auth/login", "/api/auth/refresh", "/api/auth/logout"]);

/** Audit otomatis untuk semua endpoint mutasi. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();
    const req = context.switchToHttp().getRequest();
    if (!MUTATIONS.has(req.method) || SKIP.has(req.path)) return next.handle();

    const user = req.user as RequestUser | undefined;
    return next.handle().pipe(
      tap((result) => {
        const segments: string[] = (req.path as string).split("/").filter(Boolean);
        const entityType = segments[1] ?? "unknown";
        const entityId =
          (result as { id?: number } | undefined)?.id ??
          (result as { data?: { id?: number } } | undefined)?.data?.id ??
          req.params?.id ??
          "-";
        void this.audit.log({
          actor: user,
          action: `${req.method} ${req.path}`,
          entityType,
          entityId: entityId ?? "-",
          detail: JSON.stringify(req.body ?? {}).slice(0, 500),
        });
      }),
    );
  }
}
