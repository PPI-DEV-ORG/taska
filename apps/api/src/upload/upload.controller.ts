import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
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
import { isSafeInlineMime } from "../common/utils/upload.js";

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
    @Query("category") categoryRaw: string | undefined,
    @Query("folder") folderRaw: string | undefined,
    @Query("refType") refTypeRaw: string | undefined,
    @Query("refId") refIdRaw: string | undefined,
    @Headers("x-file-name") fileName: string | undefined,
    @Headers("x-file-category") fileCategory: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException("File wajib diunggah (field: file)");
    const kind = (KINDS as string[]).includes(kindRaw ?? "") ? (kindRaw as UploadKind) : "dokumen";
    const name = fileName ?? file.originalname;
    const category = categoryRaw ?? folderRaw ?? fileCategory;
    const refType = refTypeRaw ?? category;
    const refId = refIdRaw;
    return this.service.saveNamed(file.buffer, kind, name, user, refType, refId);
  }

  @Get(":id")
  async download(@Param("id", ParseIntPipe) id: number, @Res() res: Response) {
    const file = await this.service.read(id);
    const disposition = isSafeInlineMime(file.contentType) ? "inline" : "attachment";
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Length", file.size);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `${disposition}; filename="${encodeURIComponent(file.name)}"`);
    res.end(file.buffer);
  }

  @Get(":id/meta")
  meta(@Param("id", ParseIntPipe) id: number) {
    return this.service.meta(id);
  }

  @Delete(":id")
  async remove(
    @Param("id", ParseIntPipe) id: number,
    @Query("force") force: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    const isSuperAdmin = user.role === "SUPER_ADMIN";
    const ownerId = await this.service.getOwnerId(id);
    if (ownerId === undefined) {
      return { ok: true, reason: "already_deleted" };
    }
    if (!isSuperAdmin && ownerId !== user.id) {
      throw new ForbiddenException("Hanya pengunggah file atau Super Admin yang dapat menghapus file ini.");
    }
    if (force === "true") {
      if (!isSuperAdmin) {
        throw new ForbiddenException("Hanya Super Admin yang dapat menghapus paksa file.");
      }
      return this.service.remove(id);
    }
    return this.service.safeRemove(id);
  }
}
