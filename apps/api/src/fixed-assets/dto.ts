import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";
import { PageQuery } from "../common/dto/page-query.js";

export const ASSET_TYPES = ["TANGIBLE", "INTANGIBLE"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "REGISTERED",
  "IN_SERVICE",
  "ASSIGNED",
  "UNDER_MAINTENANCE",
  "IDLE",
  "DAMAGED",
  "DISPOSED",
  "WRITTEN_OFF",
] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_CONDITIONS = [
  "EXCELLENT",
  "GOOD",
  "FAIR",
  "POOR",
  "BROKEN",
] as const;
export type AssetCondition = (typeof ASSET_CONDITIONS)[number];

export const DEPRECIATION_METHODS = [
  "STRAIGHT_LINE",
  "DECLINING_BALANCE",
  "NONE",
] as const;
export type DepreciationMethod = (typeof DEPRECIATION_METHODS)[number];

export const DISPOSAL_TYPES = [
  "SOLD",
  "SCRAPPED",
  "DAMAGED",
  "LOST",
  "DONATED",
  "WRITTEN_OFF",
] as const;
export type DisposalType = (typeof DISPOSAL_TYPES)[number];

export const AUDIT_STATUSES = ["DRAFT", "IN_PROGRESS", "COMPLETED"] as const;
export type AuditStatus = (typeof AUDIT_STATUSES)[number];

export const AUDIT_ITEM_SCAN_STATUSES = [
  "PENDING",
  "VERIFIED",
  "NOT_FOUND",
  "DAMAGED",
  "MOVED",
  "UNASSIGNED",
  "NEEDS_INVESTIGATION",
] as const;
export type AuditItemScanStatus = (typeof AUDIT_ITEM_SCAN_STATUSES)[number];

// ───────────────────────────────────────────────
// Category DTOs
// ───────────────────────────────────────────────
export class CreateCategoryDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsIn(ASSET_TYPES)
  type?: string = "TANGIBLE";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  defaultUsefulLifeMonths?: number = 48;

  @IsOptional()
  @IsIn(DEPRECIATION_METHODS)
  depreciationMethod?: string = "STRAIGHT_LINE";

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  defaultResidualRate?: number = 0;

  @IsOptional()
  @IsString()
  assetAccountCode?: string;

  @IsOptional()
  @IsString()
  accumDepAccountCode?: string;

  @IsOptional()
  @IsString()
  depExpenseAccountCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  capitalizationThreshold?: number = 0;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateCategoryDto extends CreateCategoryDto {}

// ───────────────────────────────────────────────
// Location DTOs
// ───────────────────────────────────────────────
export class CreateLocationDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  building?: string;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsString()
  room?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateLocationDto extends CreateLocationDto {}

// ───────────────────────────────────────────────
// Asset DTOs
// ───────────────────────────────────────────────
export class CreateAssetDto {
  @IsOptional()
  @IsString()
  assetCode?: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @Type(() => Number)
  @IsInt()
  categoryId!: number;

  @IsOptional()
  @IsIn(ASSET_TYPES)
  type?: string = "TANGIBLE";

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsDateString()
  acquisitionDate!: string;

  @IsDateString()
  inServiceDate!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  acquisitionCost!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  residualValue?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  usefulLifeMonths?: number = 48;

  @IsOptional()
  @IsIn(DEPRECIATION_METHODS)
  depreciationMethod?: string = "STRAIGHT_LINE";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  locationId?: number;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assignedUserId?: number;

  @IsOptional()
  @IsDateString()
  warrantyExpiry?: string;

  @IsOptional()
  @IsIn(ASSET_CONDITIONS)
  condition?: string = "GOOD";

  @IsOptional()
  @IsIn(ASSET_STATUSES)
  status?: string = "REGISTERED";

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  documentUrl?: string;

  @IsOptional()
  @IsString()
  acquisitionSource?: string = "DIRECT_PURCHASE";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  receivingId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  purchaseRequestId?: number;

  @IsOptional()
  @IsString()
  creditAccountCode?: string;

  @IsOptional()
  @IsString()
  customFields?: string;
}

export class UpdateAssetDto extends CreateAssetDto {}

// ───────────────────────────────────────────────
// Operational DTOs (Assignment, Transfer, Disposal)
// ───────────────────────────────────────────────
export class AssignAssetDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assignedToUserId?: number;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  locationId?: number;

  @IsDateString()
  assignmentDate!: string;

  @IsOptional()
  @IsIn(ASSET_CONDITIONS)
  conditionAtHandover?: string = "GOOD";

  @IsOptional()
  @IsString()
  handoverDocumentUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReturnAssetDto {
  @IsDateString()
  returnDate!: string;

  @IsOptional()
  @IsIn(ASSET_CONDITIONS)
  returnCondition?: string = "GOOD";

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  locationId?: number;
}

export class TransferAssetDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  toUserId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  toLocationId?: number;

  @IsOptional()
  @IsString()
  toDepartment?: string;

  @IsDateString()
  transferDate!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsIn(ASSET_CONDITIONS)
  condition?: string = "GOOD";
}

export class DisposeAssetDto {
  @IsDateString()
  disposalDate!: string;

  @IsIn(DISPOSAL_TYPES)
  disposalType!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  disposalPrice?: number = 0;

  @IsOptional()
  @IsString()
  buyerName?: string;

  @IsString()
  @MinLength(3)
  reason!: string;

  @IsOptional()
  @IsString()
  documentUrl?: string;

  @IsOptional()
  @IsString()
  cashAccountCode?: string; // Akun kas/bank penerima dana jika dijual
}

export class PostMonthlyDepreciationDto {
  @Type(() => Number)
  @IsInt()
  periodYear!: number;

  @Type(() => Number)
  @IsInt()
  periodMonth!: number; // 1 - 12

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  assetIds?: number[];
}

export class CreateAuditDto {
  @IsDateString()
  auditDate!: string;

  @IsString()
  @MinLength(3)
  title!: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  locationId?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AuditScanItemDto {
  @IsString()
  qrCodeOrAssetCode!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  actualLocationId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  actualUserId?: number;

  @IsOptional()
  @IsIn(ASSET_CONDITIONS)
  actualCondition?: string;

  @IsOptional()
  @IsIn(AUDIT_ITEM_SCAN_STATUSES)
  scanStatus?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}

// ───────────────────────────────────────────────
// Query DTOs
// ───────────────────────────────────────────────
export class AssetQueryDto extends PageQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  locationId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assignedUserId?: number;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: "asc" | "desc";
}

export class AssetReportQueryDto extends AssetQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  month?: number;
}
