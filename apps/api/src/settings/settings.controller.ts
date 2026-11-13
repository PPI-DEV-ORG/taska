import { Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common";
import { IsArray, IsObject, IsOptional, IsString, MinLength } from "class-validator";
import { SettingsService, type CompanyProfile } from "./settings.service.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

class SetValueDto {
  @IsString()
  @MinLength(1)
  value!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

class UpdateCompanyDto implements Partial<CompanyProfile> {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() npwp?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() bankAccount?: string;
  @IsOptional() @IsString() bankHolder?: string;
  @IsOptional() @IsString() signatoryName?: string;
  @IsOptional() @IsString() signatoryTitle?: string;
  @IsOptional() @IsString() logoFileId?: string;
  @IsOptional() @IsString() stampFileId?: string;
}

class SaveRoleDto {
  @IsString() @MinLength(1) code!: string;
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsObject() permissions!: Record<string, string>;
}

class ApplyStandardDto {
  @IsOptional() @IsArray() @IsString({ each: true }) codes?: string[];
}

@Controller("settings")
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get("company")
  getCompany() {
    return this.settings.getCompanyProfile();
  }

  @Put("company")
  @Require("settings", "U")
  updateCompany(@Body() dto: UpdateCompanyDto, @CurrentUser() user: RequestUser) {
    return this.settings.updateCompanyProfile(dto, user);
  }

  @Get("doc-formats")
  getDocFormats() {
    return this.settings.getDocFormats();
  }

  @Put("doc-formats")
  @Require("settings", "U")
  updateDocFormats(@Body() formats: Record<string, string>, @CurrentUser() user: RequestUser) {
    return this.settings.updateDocFormats(formats, user);
  }

  @Get("roles")
  getRoles() {
    return this.settings.getRoles();
  }

  @Post("roles")
  @Require("settings", "U")
  createRole(@Body() dto: SaveRoleDto, @CurrentUser() user: RequestUser) {
    return this.settings.saveRole({ ...dto, description: dto.description ?? "", isSystem: false }, user, { isNew: true });
  }

  @Put("roles/:code")
  @Require("settings", "U")
  updateRole(@Param("code") code: string, @Body() dto: SaveRoleDto, @CurrentUser() user: RequestUser) {
    return this.settings.saveRole({ ...dto, code, description: dto.description ?? "", isSystem: false }, user);
  }

  /** Terapkan matriks hak akses standar ke peran bawaan (semua, atau kode tertentu). Peran kustom tidak disentuh. */
  @Post("roles/apply-standard")
  @Require("settings", "U")
  applyStandard(@Body() dto: ApplyStandardDto, @CurrentUser() user: RequestUser) {
    return this.settings.applyStandardRoles(dto.codes, user);
  }

  @Delete("roles/:code")
  @Require("settings", "U")
  deleteRole(@Param("code") code: string, @CurrentUser() user: RequestUser) {
    return this.settings.deleteRole(code, user);
  }

  @Get()
  @Require("settings", "L")
  list() {
    return this.settings.list();
  }

  @Put(":key")
  @Require("settings", "U")
  set(@Param("key") key: string, @Body() dto: SetValueDto, @CurrentUser() user: RequestUser) {
    return this.settings.set(key, dto.value, user, dto.description);
  }
}
