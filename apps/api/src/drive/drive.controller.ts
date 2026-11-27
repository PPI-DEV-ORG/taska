import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";
import { Public } from "../common/decorators/public.decorator.js";
import { isSafeInlineMime } from "../common/utils/upload.js";
import {
  DriveService,
  type CreateFolderDto,
  type PermissionEntryDto,
  type UpdateFolderDto,
  type UploadedDriveFile,
} from "./drive.service.js";

@Controller("drive")
export class DriveController {
  constructor(private readonly service: DriveService) {}

  @Get("browse")
  browse(
    @Query("folderId") folderId: string | undefined,
    @Query("search") search: string | undefined,
    @Query("fileType") fileType: string | undefined,
    @Query("sortBy") sortBy: "name" | "updatedAt" | "size" | undefined,
    @Query("sortDir") sortDir: "asc" | "desc" | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.browse(
      {
        folderId: folderId ? Number(folderId) : null,
        search,
        fileType,
        sortBy,
        sortDir,
      },
      user,
    );
  }

  @Get("folders/tree")
  getFolderTree(@CurrentUser() user: RequestUser) {
    return this.service.getFolderTree(user);
  }

  @Post("folders")
  createFolder(@Body() dto: CreateFolderDto, @CurrentUser() user: RequestUser) {
    return this.service.createFolder(dto, user);
  }

  @Patch("folders/:id")
  updateFolder(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateFolderDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateFolder(id, dto, user);
  }

  @Post("folders/:id/move")
  moveFolder(
    @Param("id", ParseIntPipe) id: number,
    @Body("targetParentId") targetParentId: number | null | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.moveFolder(id, targetParentId, user);
  }

  @Delete("folders/:id")
  deleteFolder(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.deleteFolder(id, user);
  }

  @Get("folders/:id/access")
  getFolderAccess(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.getFolderAccess(id, user);
  }

  @Put("folders/:id/access")
  setFolderAccess(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: { isRestricted: boolean; entries: PermissionEntryDto[] },
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.setFolderAccess(id, dto, user);
  }

  @Get("access/principals")
  getAccessPrincipals(@CurrentUser() user: RequestUser) {
    return this.service.getAccessPrincipals(user);
  }

  @Post("files/upload")
  @UseInterceptors(FilesInterceptor("files", 20, { limits: { fileSize: 50 * 1024 * 1024 } }))
  uploadFiles(
    @UploadedFiles() files: UploadedDriveFile[] | undefined,
    @Body("folderId") folderIdRaw: string | undefined,
    @Body("description") description: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException("Minimal satu berkas wajib diunggah (field: files).");
    }
    const folderId = folderIdRaw && folderIdRaw !== "null" ? Number(folderIdRaw) : null;
    return this.service.uploadFiles(files, folderId, description, user);
  }

  @Patch("files/:id")
  updateFile(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: { name?: string; description?: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateFile(id, dto, user);
  }

  @Post("files/:id/move")
  moveFile(
    @Param("id", ParseIntPipe) id: number,
    @Body("targetFolderId") targetFolderId: number | null | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.moveFile(id, targetFolderId, user);
  }

  @Delete("files/:id")
  deleteFile(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.deleteFile(id, user);
  }

  @Get("files/:id/preview")
  previewFile(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.getFilePreview(id, user);
  }

  @Post("files/:id/download-token")
  createDownloadToken(
    @Param("id", ParseIntPipe) id: number,
    @Body("mode") mode: "inline" | "attachment" | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.createShortLivedToken(id, user, mode === "attachment" ? "attachment" : "inline");
  }

  @Post("files/:id/share-link")
  createShareLink(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: { expiresInDays?: number | null; permission?: "VIEW" | "DOWNLOAD"; password?: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.createShareLink(id, dto, user);
  }

  @Public()
  @Get("share/:token")
  async accessShareLink(
    @Param("token") token: string,
    @Res() res: Response,
  ) {
    return this.handleShareLinkAccess(token, undefined, res);
  }

  @Public()
  @Post("share/:token")
  async accessShareLinkWithPassword(
    @Param("token") token: string,
    @Body("password") password: string | undefined,
    @Res() res: Response,
  ) {
    return this.handleShareLinkAccess(token, password, res);
  }

  private async handleShareLinkAccess(token: string, password: string | undefined, res: Response) {
    const result = await this.service.accessShareLink(token, password);
    if (result.requiresPassword) {
      res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(`<!doctype html>
<html lang="id"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Berkas Dilindungi Kata Sandi</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;max-width:360px;width:100%;box-shadow:0 4px 20px rgba(0,0,0,.06)}
h1{font-size:16px;margin:0 0 8px;color:#0f172a}p{font-size:13px;color:#64748b;margin:0 0 16px}
input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:14px;margin-bottom:12px}
button{width:100%;padding:10px;border:none;border-radius:10px;background:#00c094;color:#fff;font-weight:600;font-size:14px;cursor:pointer}</style>
</head><body><form class="card" method="POST"><h1>Berkas Dilindungi Kata Sandi</h1>
<p>Masukkan kata sandi untuk membuka atau mengunduh berkas ini.</p>
<input type="password" name="password" placeholder="Kata sandi" required autofocus/>
<button type="submit">Buka Berkas</button></form></body></html>`);
      return;
    }
    const safeMode = result.mode === "inline" && isSafeInlineMime(result.mimeType) ? "inline" : "attachment";
    res.setHeader("Content-Type", result.mimeType);
    res.setHeader("Content-Length", result.size);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Disposition",
      `${safeMode}; filename="${encodeURIComponent(result.fileName)}"`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.end(result.buffer);
  }

  @Get("files/:id/content")
  async getContent(
    @Param("id", ParseIntPipe) id: number,
    @Query("download") download: string | undefined,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    const mode = download === "1" || download === "true" ? "attachment" : "inline";
    const result = await this.service.getFileContent(id, user, mode);
    const safeMode = mode === "inline" && isSafeInlineMime(result.mimeType) ? "inline" : "attachment";
    res.setHeader("Content-Type", result.mimeType);
    res.setHeader("Content-Length", result.size);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Disposition",
      `${safeMode}; filename="${encodeURIComponent(result.fileName)}"`,
    );
    res.setHeader("Cache-Control", "private, max-age=60");
    res.end(result.buffer);
  }

  /**
   * Akses konten via signed short-lived token (berlaku 2 menit) untuk native Linking.openURL.
   */
  @Public()
  @Get("files/:id/signed")
  async getSignedContent(
    @Param("id", ParseIntPipe) id: number,
    @Query("token") token: string | undefined,
    @Res() res: Response,
  ) {
    if (!token) throw new BadRequestException("Token wajib disertakan.");
    const { mode } = this.service.verifyShortLivedToken(token, id);
    const result = await this.service.getFileContent(id, null, mode, true);
    const safeMode = mode === "inline" && isSafeInlineMime(result.mimeType) ? "inline" : "attachment";
    res.setHeader("Content-Type", result.mimeType);
    res.setHeader("Content-Length", result.size);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Disposition",
      `${safeMode}; filename="${encodeURIComponent(result.fileName)}"`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.end(result.buffer);
  }
}
