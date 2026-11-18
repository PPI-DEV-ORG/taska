import {
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
} from "@nestjs/common";
import { FixedAssetsService } from "./fixed-assets.service.js";
import {
  AssetQueryDto,
  AssetReportQueryDto,
  AssignAssetDto,
  AuditScanItemDto,
  CreateAssetDto,
  CreateAuditDto,
  CreateCategoryDto,
  CreateLocationDto,
  DisposeAssetDto,
  PostMonthlyDepreciationDto,
  ReturnAssetDto,
  TransferAssetDto,
  UpdateAssetDto,
  UpdateCategoryDto,
  UpdateLocationDto,
} from "./dto.js";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { Require } from "../common/decorators/require-permission.decorator.js";

@Controller("fixed-assets")
export class FixedAssetsController {
  constructor(private readonly service: FixedAssetsService) {}

  // ───────────────────────────────────────────────
  // Dashboard & Ringkasan KPI
  // ───────────────────────────────────────────────
  @Get("dashboard")
  @Require("fixedAssets", "L")
  getDashboard() {
    return this.service.getDashboard();
  }

  // ───────────────────────────────────────────────
  // Kategori Aset
  // ───────────────────────────────────────────────
  @Get("categories")
  @Require("fixedAssets", "L")
  listCategories() {
    return this.service.listCategories();
  }

  @Get("categories/:id")
  @Require("fixedAssets", "L")
  getCategory(@Param("id", ParseIntPipe) id: number) {
    return this.service.getCategory(id);
  }

  @Post("categories")
  @Require("fixedAssets", "C")
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Put("categories/:id")
  @Patch("categories/:id")
  @Require("fixedAssets", "U")
  updateCategory(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.service.updateCategory(id, dto);
  }

  @Delete("categories/:id")
  @Require("fixedAssets", "A")
  deleteCategory(@Param("id", ParseIntPipe) id: number) {
    return this.service.deleteCategory(id);
  }

  // ───────────────────────────────────────────────
  // Lokasi Aset
  // ───────────────────────────────────────────────
  @Get("locations")
  @Require("fixedAssets", "L")
  listLocations() {
    return this.service.listLocations();
  }

  @Get("locations/:id")
  @Require("fixedAssets", "L")
  getLocation(@Param("id", ParseIntPipe) id: number) {
    return this.service.getLocation(id);
  }

  @Post("locations")
  @Require("fixedAssets", "C")
  createLocation(@Body() dto: CreateLocationDto) {
    return this.service.createLocation(dto);
  }

  @Put("locations/:id")
  @Patch("locations/:id")
  @Require("fixedAssets", "U")
  updateLocation(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.service.updateLocation(id, dto);
  }

  @Delete("locations/:id")
  @Require("fixedAssets", "A")
  deleteLocation(@Param("id", ParseIntPipe) id: number) {
    return this.service.deleteLocation(id);
  }

  // ───────────────────────────────────────────────
  // Audit Fisik & Opname via QR Code
  // ───────────────────────────────────────────────
  @Get("audits")
  @Require("fixedAssets", "L")
  listAudits() {
    return this.service.listAudits();
  }

  @Get("audits/:id")
  @Require("fixedAssets", "L")
  getAudit(@Param("id", ParseIntPipe) id: number) {
    return this.service.getAudit(id);
  }

  @Post("audits")
  @Require("fixedAssets", "C")
  createAudit(@Body() dto: CreateAuditDto, @CurrentUser() user: RequestUser) {
    return this.service.createAudit(dto, user);
  }

  @Post("audits/:id/scan")
  @Require("fixedAssets", "U")
  scanAuditItem(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AuditScanItemDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.scanAuditItem(id, dto, user);
  }

  @Post("audits/:id/complete")
  @Require("fixedAssets", "V")
  completeAudit(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.completeAudit(id, user);
  }

  // ───────────────────────────────────────────────
  // Pelaporan
  // ───────────────────────────────────────────────
  @Get("reports/register")
  @Require("fixedAssets", "E")
  getRegisterReport(@Query() query: AssetReportQueryDto) {
    return this.service.getRegisterReport(query);
  }

  @Get("reports/movement")
  @Require("fixedAssets", "E")
  getMovementReport() {
    return this.service.getMovementReport();
  }

  @Get("reports/disposal")
  @Require("fixedAssets", "E")
  getDisposalReport() {
    return this.service.getDisposalReport();
  }

  @Get("reports/depreciation")
  @Require("fixedAssets", "E")
  getDepreciationReport(
    @Query("year", ParseIntPipe) year?: number,
    @Query("month", ParseIntPipe) month?: number,
  ) {
    return this.service.getDepreciationReport(year, month);
  }

  @Get("reports/:type")
  @Require("fixedAssets", "E")
  getReport(
    @Param("type") type: string,
    @Query() query: AssetReportQueryDto,
  ) {
    return this.service.getReport(type, query);
  }

  // ───────────────────────────────────────────────
  // Depresiasi Bulanan ke Accounting
  // ───────────────────────────────────────────────
  @Post("depreciation/post-monthly")
  @Require("fixedAssets", "V")
  postMonthlyDepreciation(
    @Body() dto: PostMonthlyDepreciationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.postMonthlyDepreciation(dto, user);
  }

  // ───────────────────────────────────────────────
  // Lookup / Scan QR Code
  // ───────────────────────────────────────────────
  @Get("scan/:codeOrQr")
  @Require("fixedAssets", "L")
  scan(@Param("codeOrQr") codeOrQr: string) {
    return this.service.getAssetByQrOrCode(codeOrQr);
  }

  // ───────────────────────────────────────────────
  // Master Aset Tetap
  // ───────────────────────────────────────────────
  @Get()
  @Require("fixedAssets", "L")
  list(@Query() query: AssetQueryDto) {
    return this.service.listAssets(query);
  }

  @Get(":id/qr-code")
  @Require("fixedAssets", "L")
  getQrCode(@Param("id") id: string) {
    return this.service.getAssetQrCode(id);
  }

  @Get(":id")
  @Require("fixedAssets", "L")
  async get(@Param("id") id: string) {
    const num = Number(id);
    if (!isNaN(num) && Number.isInteger(num)) {
      return this.service.getAsset(num);
    }
    const asset = await this.service.getAssetByQrOrCode(id);
    return this.service.getAsset(asset.id);
  }

  @Post()
  @Require("fixedAssets", "C")
  create(@Body() dto: CreateAssetDto, @CurrentUser() user: RequestUser) {
    return this.service.createAsset(dto, user);
  }

  @Put(":id")
  @Patch(":id")
  @Require("fixedAssets", "U")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateAssetDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateAsset(id, dto, user);
  }

  @Delete(":id")
  @Require("fixedAssets", "A")
  delete(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    return this.service.deleteAsset(id, user);
  }

  // ───────────────────────────────────────────────
  // Operasional Aset: Serah Terima, Pengembalian, Mutasi, Pelepasan
  // ───────────────────────────────────────────────
  @Post(":id/assign")
  @Require("fixedAssets", "U")
  assign(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AssignAssetDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.assignAsset(id, dto, user);
  }

  @Post(":id/return")
  @Require("fixedAssets", "U")
  returnAsset(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReturnAssetDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.returnAsset(id, dto, user);
  }

  @Post(":id/transfer")
  @Require("fixedAssets", "U")
  transfer(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: TransferAssetDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.transferAsset(id, dto, user);
  }

  @Post(":id/dispose")
  @Require("fixedAssets", "V")
  dispose(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: DisposeAssetDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.disposeAsset(id, dto, user);
  }
}
