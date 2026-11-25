import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";

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
}
