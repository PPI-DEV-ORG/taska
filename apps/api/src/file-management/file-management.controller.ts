import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { FileManagementService, type CreateShareDto, type ListFilesQuery } from "./file-management.service.js";
import { FileProviderService, type CreateProviderDto, type UpdateProviderDto } from "./provider.service.js";
import { FileMigrationService, type StartDriveMigrationDto, type StartMigrationDto } from "./migration.service.js";
import { FileSchedulerService, type CreateScheduleDto } from "./scheduler.service.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { Public } from "../common/decorators/public.decorator.js";

type Uploaded = { buffer: Buffer; originalname?: string; mimetype?: string };

@Controller("file-management")
export class FileManagementController {
  constructor(
    private readonly service: FileManagementService,
    private readonly providerService: FileProviderService,
    private readonly migrationService: FileMigrationService,
    private readonly schedulerService: FileSchedulerService,
  ) {}

  // ───────────────────────────────────────────────
  // Overview & Server Storage
  // ───────────────────────────────────────────────
  @Get("overview")
  @Require("fileManagement", "L")
  getOverview() {
    return this.service.getOverview();
  }

  @Get("server-storage")
  @Require("fileManagement", "L")
  getServerStorage() {
    return this.service.getServerStorage();
  }

  // ───────────────────────────────────────────────
  // File Explorer
  // ───────────────────────────────────────────────
  @Get("files")
  @Require("fileManagement", "L")
  listFiles(@Query() query: ListFilesQuery, @CurrentUser() user: RequestUser) {
    return this.service.listFiles(query, user);
  }

  @Get("files/:id")
  @Require("fileManagement", "L")
  getFileDetail(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.getFileDetail(id, user);
  }

  @Patch("files/:id")
  @Require("fileManagement", "U")
  updateMetadata(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: { displayName?: string; description?: string; categoryId?: number; visibility?: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateMetadata(id, dto, user);
  }

  @Put("files/:id/replace")
  @Require("fileManagement", "U")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 100 * 1024 * 1024 } }))
  replaceFile(
    @Param("id", ParseIntPipe) id: number,
    @UploadedFile() file: Uploaded | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException("File pengganti wajib diunggah (field: file)");
    return this.service.replaceFile(
      id,
      file.buffer,
      file.originalname || "replacement",
      file.mimetype || "application/octet-stream",
      user,
    );
  }

  @Post("files/:id/cleanup-local")
  @Require("fileManagement", "U")
  cleanupLocalCopy(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.cleanupLocalCopy(id, user);
  }

  @Delete("files/:id")
  @Require("fileManagement", "A")
  deleteFile(
    @Param("id", ParseIntPipe) id: number,
    @Query("force") force: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.deleteFile(id, user, force === "true");
  }

  @Post("files/bulk-delete-orphans")
  @Require("fileManagement", "A")
  bulkDeleteOrphans(@Body("fileIds") fileIds: number[], @CurrentUser() user: RequestUser) {
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      throw new BadRequestException("Daftar ID file lepas (standalone) wajib disertakan");
    }
    return this.service.bulkDeleteOrphans(fileIds, user);
  }

  @Post("files/:id/shares")
  @Require("fileManagement", "U")
  createShareLink(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateShareDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.createShareLink(id, dto, user);
  }

  // ───────────────────────────────────────────────
  // Storage Providers
  // ───────────────────────────────────────────────
  @Get("providers")
  @Require("fileManagement", "L")
  listProviders() {
    return this.providerService.listProviders();
  }

  @Get("providers/:id")
  @Require("fileManagement", "L")
  getProviderDetail(@Param("id", ParseIntPipe) id: number) {
    return this.providerService.getProviderDetail(id);
  }

  @Post("providers")
  @Require("fileManagement", "V")
  createProvider(@Body() dto: CreateProviderDto, @CurrentUser() user: RequestUser) {
    return this.providerService.createProvider(dto, user);
  }

  @Patch("providers/:id")
  @Require("fileManagement", "V")
  updateProvider(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateProviderDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.providerService.updateProvider(id, dto, user);
  }

  @Post("providers/:id/test")
  @Require("fileManagement", "V")
  testProvider(@Param("id", ParseIntPipe) id: number) {
    return this.providerService.testExistingProvider(id);
  }

  @Post("providers/:id/set-default")
  @Require("fileManagement", "V")
  setDefaultProvider(@Param("id", ParseIntPipe) id: number) {
    return this.providerService.setDefault(id);
  }

  @Delete("providers/:id")
  @Require("fileManagement", "V")
  deleteProvider(@Param("id", ParseIntPipe) id: number) {
    return this.providerService.deleteProvider(id);
  }

  @Get("providers/:id/browse")
  @Require("fileManagement", "L")
  browseProvider(@Param("id", ParseIntPipe) id: number, @Query("path") path?: string) {
    return this.providerService.browseProvider(id, path || "");
  }

  // ───────────────────────────────────────────────
  // Migrasi File
  // ───────────────────────────────────────────────
  @Post("migrations")
  @Require("fileManagement", "V")
  startMigration(@Body() dto: StartMigrationDto, @CurrentUser() user: RequestUser) {
    return this.migrationService.startMigration(dto, user);
  }

  @Get("migrations/preview")
  @Require("fileManagement", "L")
  previewMigration(
    @Query("sourceProviderId", ParseIntPipe) sourceProviderId: number,
    @Query("targetProviderId") targetProviderId?: string,
    @Query("folder") folder?: string,
    @Query("olderThanDays") olderThanDays?: string,
  ) {
    return this.migrationService.previewMigration({
      sourceProviderId,
      targetProviderId: targetProviderId ? Number(targetProviderId) : undefined,
      folder,
      olderThanDays: olderThanDays ? Number(olderThanDays) : undefined,
    });
  }

  @Get("migrations/drive/preview")
  @Require("fileManagement", "L")
  previewDriveMigration(
    @Query("sourceProviderId", ParseIntPipe) sourceProviderId: number,
    @Query("targetProviderId") targetProviderId?: string,
    @Query("folderId") folderId?: string,
    @Query("includeSubfolders") includeSubfolders?: string,
    @Query("olderThanDays") olderThanDays?: string,
  ) {
    return this.migrationService.previewDriveMigration({
      sourceProviderId,
      targetProviderId: targetProviderId ? Number(targetProviderId) : undefined,
      folderId,
      includeSubfolders: includeSubfolders !== "false",
      olderThanDays: olderThanDays ? Number(olderThanDays) : undefined,
    });
  }

  @Post("migrations/drive")
  @Require("fileManagement", "V")
  migrateDriveFiles(@Body() dto: StartDriveMigrationDto, @CurrentUser() user: RequestUser) {
    return this.migrationService.migrateDriveFiles(dto, user);
  }

  @Get("migrations")
  @Require("fileManagement", "L")
  listMigrations(@Query("limit") limit?: string) {
    return this.migrationService.listJobs(limit ? Number(limit) : 50);
  }

  @Get("migrations/:id")
  @Require("fileManagement", "L")
  getMigrationDetail(@Param("id", ParseIntPipe) id: number) {
    return this.migrationService.getJobDetail(id);
  }

  @Post("migrations/:id/cleanup")
  @Require("fileManagement", "V")
  cleanupMigration(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.migrationService.cleanupJobFiles(id, user);
  }

  @Post("migrations/:id/rollback")
  @Require("fileManagement", "V")
  rollbackMigration(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.migrationService.rollbackJob(id, user);
  }

  @Post("migrations/:id/retry")
  @Require("fileManagement", "V")
  retryMigration(@Param("id", ParseIntPipe) id: number) {
    return this.migrationService.retryJob(id);
  }

  // ───────────────────────────────────────────────
  // Jadwal Migrasi Otomatis
  // ───────────────────────────────────────────────
  @Get("schedules")
  @Require("fileManagement", "L")
  listSchedules() {
    return this.schedulerService.listSchedules();
  }

  @Post("schedules")
  @Require("fileManagement", "V")
  createSchedule(@Body() dto: CreateScheduleDto, @CurrentUser() user: RequestUser) {
    return this.schedulerService.createSchedule(dto, user);
  }

  @Patch("schedules/:id")
  @Require("fileManagement", "V")
  updateSchedule(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: Partial<CreateScheduleDto>,
    @CurrentUser() user: RequestUser,
  ) {
    return this.schedulerService.updateSchedule(id, dto, user);
  }

  @Delete("schedules/:id")
  @Require("fileManagement", "V")
  deleteSchedule(@Param("id", ParseIntPipe) id: number) {
    return this.schedulerService.deleteSchedule(id);
  }
}

/**
 * Controller publik untuk akses Share Link (`GET /api/share/:token`)
 */
@Controller("share")
export class FileShareController {
  constructor(private readonly service: FileManagementService) {}

  @Public()
  @Get(":token")
  async accessShare(
    @Param("token") token: string,
    @Query("password") password: string | undefined,
    @Headers("user-agent") userAgent: string | undefined,
    @Headers("x-forwarded-for") ip: string | undefined,
    @Res() res: Response,
  ) {
    const result = await this.service.accessSharedFile(token, password, ip, userAgent);
    const disposition = result.permission === "DOWNLOAD" ? "attachment" : "inline";
    res.setHeader("Content-Type", result.mimeType);
    res.setHeader("Content-Length", result.size);
    res.setHeader("Content-Disposition", `${disposition}; filename="${encodeURIComponent(result.fileName)}"`);
    res.end(result.buffer);
  }
}
