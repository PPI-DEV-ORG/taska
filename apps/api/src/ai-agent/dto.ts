import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class PageContextDto {
  @IsOptional()
  @IsString()
  pathname?: string;

  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsString()
  entityId?: string;
}

export class ChatAttachmentDto {
  @Type(() => Number)
  @IsInt({ message: "fileId lampiran harus berupa angka" })
  @Min(1)
  fileId!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;
}

export class SendAiChatDto {
  @IsString({ message: "Pesan harus berupa teks" })
  @IsNotEmpty({ message: "Pertanyaan tidak boleh kosong" })
  @MaxLength(2000, { message: "Pertanyaan maksimal 2000 karakter" })
  message!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "ID sesi harus berupa angka" })
  @Min(1, { message: "ID sesi tidak valid" })
  sessionId?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => PageContextDto)
  pageContext?: PageContextDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatAttachmentDto)
  attachments?: ChatAttachmentDto[];
}

export class UpdateAiSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fallbackModels?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5000)
  @Max(120000)
  timeoutMs?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @IsOptional()
  @IsBoolean()
  clearApiKey?: boolean;
}
