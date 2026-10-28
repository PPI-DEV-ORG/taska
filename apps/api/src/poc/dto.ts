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

export const POC_TYPES = ["DEMO_CLIENT", "EXPO_EXHIBITION", "INTERNAL_POC"] as const;
export type PocType = (typeof POC_TYPES)[number];

export const POC_STATUSES = [
  "Draft",
  "Planned",
  "Preparation",
  "Ready",
  "In Progress",
  "Completed",
  "On Hold",
  "Cancelled",
] as const;
export type PocStatus = (typeof POC_STATUSES)[number];

export const POC_RESULT_STATUSES = [
  "Pending Evaluation",
  "Success",
  "Partial Success",
  "Failed",
] as const;
export type PocResultStatus = (typeof POC_RESULT_STATUSES)[number];

export class PocReportDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return value;
    const str = String(value).trim();
    if (str === "EXPO_EXHIBITION" || /pameran|expo/i.test(str)) return "EXPO_EXHIBITION";
    if (str === "INTERNAL_POC" || /internal/i.test(str)) return "INTERNAL_POC";
    if (str === "DEMO_CLIENT" || /klien|client|demo/i.test(str)) return "DEMO_CLIENT";
    return str;
  })
  @IsIn(POC_TYPES)
  type?: string;

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
  @IsIn(POC_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(POC_RESULT_STATUSES)
  resultStatus?: string;

  @IsOptional()
  @IsString()
  clientName?: string;

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
  targetCriteria?: string;

  @IsOptional()
  @IsString()
  productsTested?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budget?: number;

  @IsOptional()
  @IsDateString()
  actualExecutionDate?: string;

  @IsOptional()
  @IsString()
  actualAttendees?: string;

  @IsOptional()
  @IsString()
  activitiesDone?: string;

  @IsOptional()
  @IsString()
  testResults?: string;

  @IsOptional()
  @IsString()
  issuesFound?: string;

  @IsOptional()
  @IsString()
  followUpNeeded?: string;

  @IsOptional()
  @IsString()
  conclusion?: string;

  @IsOptional()
  @IsString()
  recommendations?: string;

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
  @IsArray()
  memberUserIds?: number[];
}

export class PocChecklistDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsBoolean()
  isDone?: boolean;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assigneeId?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PocStatusDto {
  @IsOptional()
  @IsIn(POC_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(POC_RESULT_STATUSES)
  resultStatus?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PocListQuery extends PageQuery {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  resultStatus?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

