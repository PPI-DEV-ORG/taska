import { IsEmail, IsIn, IsInt, IsOptional, IsString, MinLength } from "class-validator";
import { Role } from "../../generated/prisma/client.js";

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

  @IsOptional() @IsIn(Object.values(Role))
  role?: Role;

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

  @IsOptional() @IsIn(Object.values(Role))
  role?: Role;

  @IsOptional() @IsIn(["AKTIF", "NONAKTIF"])
  status?: "AKTIF" | "NONAKTIF";

  @IsOptional() @IsInt()
  warehouseId?: number | null;

  @IsOptional() @IsString()
  password?: string;
}
