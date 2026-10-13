import { Type } from "class-transformer";
import { IsEmail, IsInt, IsOptional, IsString, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(4)
  password!: string;
}

export class RefreshDto {
  @IsString()
  @MinLength(10)
  refreshToken!: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  avatarFileId?: number;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(4)
  oldPassword!: string;

  @IsString()
  @MinLength(4)
  newPassword!: string;
}
