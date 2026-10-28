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

export const VISIT_STATUSES = ["Planned", "Completed", "Cancelled"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const ACTION_STATUSES = ["Open", "In Progress", "Done"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export class VisitReportDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  activityTypeId?: number;

  @IsOptional()
  @IsString()
  activityTypeName?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return value;
    const str = String(value).trim().toLowerCase();
    if (str === "planned" || str === "direncanakan") return "Planned";
    if (str === "completed" || str === "selesai") return "Completed";
    if (str === "cancelled" || str === "batal" || str === "dibatalkan") return "Cancelled";
    return value;
  })
  @IsIn(VISIT_STATUSES)
  status?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

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

  // Minutes of Meeting (MoM)
  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  clientNeeds?: string;

  @IsOptional()
  @IsString()
  productsIntroduced?: string;

  @IsOptional()
  @IsString()
  clientFeedback?: string;

  @IsOptional()
  @IsString()
  agreements?: string;

  @IsOptional()
  @IsString()
  potentialOpportunities?: string;

  @IsOptional()
  @IsString()
  obstacles?: string;

  @IsOptional()
  @IsString()
  conclusion?: string;

  // Custom PDF
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

export class VisitStatusDto {
  @Transform(({ value }) => {
    if (!value) return value;
    const str = String(value).trim().toLowerCase();
    if (str === "planned" || str === "direncanakan") return "Planned";
    if (str === "completed" || str === "selesai") return "Completed";
    if (str === "cancelled" || str === "batal" || str === "dibatalkan") return "Cancelled";
    return value;
  })
  @IsIn(VISIT_STATUSES)
  status!: string;
}

export class VisitActionItemDto {
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

export class VisitListQuery extends PageQuery {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  activityTypeId?: number;

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
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

