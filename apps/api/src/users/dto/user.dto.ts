import { Transform } from "class-transformer";
import { IsEmail, IsIn, IsInt, IsOptional, IsString, MinLength } from "class-validator";
import { Role } from "../../generated/prisma/client.js";

function normalizeRole(value: unknown) {
  if (typeof value !== "string") return value;
  const v = value.toUpperCase().trim().replace(/[\s\-]/g, "_");
  if (v === "SUPERADMIN" || v === "SUPER_ADMIN") return Role.SUPER_ADMIN;
  if (v === "ADMIN") return Role.ADMIN;
  if (v === "BOS" || v === "ADMIN_/_BOS") return Role.BOS;
  if (v === "SALES") return Role.SALES;
  if (v === "PM" || v === "PROJECT_MANAGER") return Role.PM;
  if (v === "TEKNISI" || v === "TECHNICIAN") return Role.TEKNISI;
  if (v === "PROCUREMENT" || v === "PURCHASING") return Role.PROCUREMENT;
  if (v === "FINANCE" || v === "KEUANGAN") return Role.FINANCE;
  if (v === "GUDANG" || v === "WAREHOUSE") return Role.GUDANG;
  if (v === "SE" || v === "SOFTWARE_ENGINEER" || v === "ENGINEER") return Role.SE;
  return v;
}

function normalizeActiveStatus(value: unknown) {
  if (typeof value !== "string") return value;
  const v = value.toUpperCase().trim().replace(/[\s\-]/g, "_");
  if (v === "AKTIF" || v === "ACTIVE") return "AKTIF";
  if (v === "NONAKTIF" || v === "NON_AKTIF" || v === "INACTIVE") return "NONAKTIF";
  return v;
}

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsOptional() @IsString()
  password?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional() @IsString()
  phone?: string;

  @IsOptional() @IsString()
  position?: string;

  @IsOptional() @IsString()
  department?: string;

  @Transform(({ value }) => normalizeRole(value))
  @IsOptional() @IsIn(Object.values(Role))
  role?: Role;

  @Transform(({ value }) => normalizeActiveStatus(value))
  @IsOptional() @IsIn(["AKTIF", "NONAKTIF"])
  status?: "AKTIF" | "NONAKTIF";

  @IsOptional() @IsInt()
  warehouseId?: number;
}

export class UpdateUserDto {
  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString() @MinLength(1)
  name?: string;

  @IsOptional() @IsString()
  phone?: string;

  @IsOptional() @IsString()
  position?: string;

  @IsOptional() @IsString()
  department?: string;

  @Transform(({ value }) => normalizeRole(value))
  @IsOptional() @IsIn(Object.values(Role))
  role?: Role;

  @Transform(({ value }) => normalizeActiveStatus(value))
  @IsOptional() @IsIn(["AKTIF", "NONAKTIF"])
  status?: "AKTIF" | "NONAKTIF";

  @IsOptional() @IsInt()
  warehouseId?: number | null;

  @IsOptional() @IsString()
  password?: string;
}
