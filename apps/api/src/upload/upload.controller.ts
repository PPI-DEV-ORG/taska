import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { UploadService, type UploadKind } from "./upload.service.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";

const KINDS: UploadKind[] = ["foto", "dokumen", "video"];

type Uploaded = { buffer: Buffer; originalname?: string };

@Controller("files")
export class UploadController {
  constructor(private readonly service: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 50 * 1024 * 1024 } }))
  uploadFile(
    @UploadedFile() file: Uploaded | undefined,
    @Query("kind") kindRaw: string | undefined,
    @Headers("x-file-name") fileName: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException("File wajib diunggah (field: file)");
    const kind = (KINDS as string[]).includes(kindRaw ?? "") ? (kindRaw as UploadKind) : "dokumen";
    const name = fileName ?? file.originalname;
    return this.service.saveNamed(file.buffer, kind, name, user);
  }

  @Get(":id")
  async download(@Param("id", ParseIntPipe) id: number, @Res() res: Response) {
    const file = await this.service.read(id);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Length", file.size);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.name)}"`);
    return res.send(file.buffer);
  }

  @Get(":id/meta")
  meta(@Param("id", ParseIntPipe) id: number) {
    return this.service.meta(id);
  }
}
