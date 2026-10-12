import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ImportsService } from "./imports.service.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";
import { IsIn } from "class-validator";

const TYPES = ["customer", "supplier", "product", "warehouse", "stock", "serial"] as const;
export type ImportType = (typeof TYPES)[number];

class ImportQueryDto {
  @IsIn(TYPES as unknown as string[])
  type!: ImportType;
}

type Uploaded = { buffer: Buffer; originalname?: string };

@Controller("imports")
export class ImportsController {
  constructor(private readonly service: ImportsService) {}

  @Get("template")
  async template(@Query() q: ImportQueryDto): Promise<StreamableFile> {
    const buffer = await this.service.template(q.type);
    return new StreamableFile(buffer, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      disposition: `attachment; filename="template-import-${q.type}.xlsx"`,
    });
  }

  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 20 * 1024 * 1024 } }))
  async upload(
    @UploadedFile() file: Uploaded | undefined,
    @Query() q: ImportQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException("File wajib diunggah (field: file)");
    return this.service.import(q.type, file.buffer, user);
  }
}
