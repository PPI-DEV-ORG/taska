import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSION_KEY, type PermissionMeta } from "../decorators/require-permission.decorator.js";
import { can } from "../../rbac/permissions.js";
import type { RequestUser } from "../decorators/current-user.decorator.js";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const meta = this.reflector.getAllAndOverride<PermissionMeta | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) return true;

    const user = context.switchToHttp().getRequest().user as RequestUser | undefined;
    if (!user) throw new ForbiddenException("Tidak terautentikasi");

    if (!can(user.role, meta.module, meta.action)) {
      throw new ForbiddenException(
        `Akses ditolak: peran ${user.role} tidak memiliki hak ${meta.action} pada modul ${meta.module}`,
      );
    }
    return true;
  }
}
