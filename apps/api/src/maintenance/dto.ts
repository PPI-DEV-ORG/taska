import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { PageQuery } from "../common/dto/page-query.js";

export const MAINTENANCE_STATUSES = [
  "Scheduled",
  "In_Progress",
  "Completed",
  "Cancelled",
] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const ACTION_STATUSES = ["Open", "In Progress", "Done"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export class MaintenanceReportDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @IsOptional()
  @IsString()
  maintenanceType?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return value;
    const str = String(value).trim().toLowerCase().replace(/[\s\-]+/g, "_");
    if (str === "scheduled" || str === "terjadwal" || str === "planned") return "Scheduled";
    if (str === "in_progress" || str === "sedang_dikerjakan" || str === "berjalan") return "In_Progress";
    if (str === "completed" || str === "selesai") return "Completed";
    if (str === "cancelled" || str === "batal" || str === "dibatalkan") return "Cancelled";
    return value;
  })
  @IsIn(MAINTENANCE_STATUSES)
  status?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsString()
  clientContact?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  leadId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectId?: number;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  findings?: string;

  @IsOptional()
  @IsString()
  actionsTaken?: string;

  @IsOptional()
  @IsString()
  recommendations?: string;

  @IsOptional()
  @IsString()
  conclusion?: string;

  @IsOptional()
  @IsString()
  companyHeader?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  logoFileId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  documentFileId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ownerId?: number;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  memberUserIds?: number[];
}

export class MaintenanceStatusDto {
  @Transform(({ value }) => {
    if (!value) return value;
    const str = String(value).trim().toLowerCase().replace(/[\s\-]+/g, "_");
    if (str === "scheduled" || str === "terjadwal" || str === "planned") return "Scheduled";
    if (str === "in_progress" || str === "sedang_dikerjakan" || str === "berjalan") return "In_Progress";
    if (str === "completed" || str === "selesai") return "Completed";
    if (str === "cancelled" || str === "batal" || str === "dibatalkan") return "Cancelled";
    return value;
  })
  @IsIn(MAINTENANCE_STATUSES)
  status!: string;
}

export class MaintenanceActionItemDto {
  @IsString()
  @MinLength(2)
  task!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assigneeId?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return "Open";
    const str = String(value).trim().toLowerCase();
    if (str === "open" || str === "buka") return "Open";
    if (str === "in progress" || str === "berjalan" || str === "in_progress") return "In Progress";
    if (str === "done" || str === "selesai") return "Done";
    return value;
  })
  @IsIn(ACTION_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class MaintenanceListQuery extends PageQuery {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  maintenanceType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  leadId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ownerId?: number;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
