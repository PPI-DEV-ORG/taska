import { Body, Controller, Get, Param, Post, Put } from "@nestjs/common";
import { IsObject } from "class-validator";
import { RbacService } from "./rbac.service.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

class UpdateRoleDto {
  /** { namaModul: "LCU" } — hanya modul yang dikirim yang diubah. */
  @IsObject()
  permissions!: Record<string, string>;
}

@Controller("rbac")
export class RbacController {
  constructor(private readonly service: RbacService) {}

  /** Hak akses efektif user yang sedang login (menu & tombol di aplikasi). */
  @Get("me")
  me(@CurrentUser() user: RequestUser) {
    return this.service.forUser(user);
  }

  @Get("matrix")
  matrix(@CurrentUser() user: RequestUser) {
    this.service.assertSuperAdmin(user);
    return this.service.matrix();
  }

  @Put("roles/:role")
  update(@Param("role") role: string, @Body() dto: UpdateRoleDto, @CurrentUser() user: RequestUser) {
    return this.service.updateRole(role, dto.permissions, user);
  }

  @Post("roles/:role/reset")
  reset(@Param("role") role: string, @CurrentUser() user: RequestUser) {
    return this.service.resetRole(role, user);
  }
}
