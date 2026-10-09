import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from "class-validator";
import { PageQuery } from "../common/dto/page-query.js";

const PROJECT_TYPES = ["CUSTOMER", "PRODUCT_RD", "INTERNAL", "MAINTENANCE", "SUPPORT", "OTHER"] as const;
const PROJECT_STATUS = ["DIRENCANAKAN", "BERJALAN", "DITUNDA", "TERLAMBAT", "SELESAI"] as const;
const TASK_STATUS = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;
const PRIORITY = ["RENDAH", "SEDANG", "TINGGI", "URGENT"] as const;

export class ProjectListQuery extends PageQuery {
  @IsOptional() @IsIn(PROJECT_STATUS)
  status?: (typeof PROJECT_STATUS)[number];

  @IsOptional() @IsIn(PROJECT_TYPES)
  type?: (typeof PROJECT_TYPES)[number];

  @IsOptional() @Type(() => Number) @IsInt()
  picId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  customerId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  memberId?: number;

  @IsOptional() @IsIn(["BELUM_LUNAS", "LUNAS"])
  paymentStatus?: "BELUM_LUNAS" | "LUNAS";
}

export class ProjectDto {
  @IsString() @MinLength(1)
  name!: string;

  @IsOptional() @IsIn(PROJECT_TYPES)
  type?: (typeof PROJECT_TYPES)[number];

  @IsOptional() @IsInt()
  customerId?: number;

  @IsOptional() @IsInt()
  picId?: number;

  @IsOptional() @IsInt()
  quotationId?: number;

  @IsDateString()
  startDate!: string;

  @IsOptional() @IsDateString()
  endDate?: string;

  @IsOptional() @IsIn(PROJECT_STATUS)
  status?: (typeof PROJECT_STATUS)[number];

  @IsOptional() @IsInt() @Min(0) @Max(100)
  progress?: number;

  @IsOptional() @IsInt()
  prdFileId?: number;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsArray() @IsInt({ each: true })
  memberIds?: number[];
}

export class ProjectStatusDto {
  @IsIn(PROJECT_STATUS)
  status!: (typeof PROJECT_STATUS)[number];

  @IsOptional() @IsString()
  note?: string;
}

export class MemberDto {
  @IsInt()
  userId!: number;
}

export class AssignDto {
  @IsInt()
  userId!: number;
}

export class RequirementDto {
  @IsInt()
  productId!: number;

  @IsOptional() @IsInt()
  taskId?: number;

  @IsInt() @Min(1)
  qty!: number;
}

export class TaskDto {
  @IsString() @MinLength(1)
  name!: string;

  @IsOptional() @IsInt()
  parentId?: number;

  @IsOptional() @IsInt()
  assigneeId?: number;

  @IsOptional() @IsDateString()
  dueDate?: string;

  @IsOptional() @IsIn(PRIORITY)
  priority?: (typeof PRIORITY)[number];

  @IsOptional() @IsInt() @Min(0) @Max(100)
  progress?: number;

  @IsOptional() @IsBoolean()
  needsPurchase?: boolean;

  @IsOptional() @IsInt()
  bahpFileId?: number;

  @IsOptional() @IsInt()
  bastFileId?: number;

  @IsOptional() @IsInt()
  doFileId?: number;
}

export class TaskStatusDto {
  @IsIn(TASK_STATUS)
  status!: (typeof TASK_STATUS)[number];

  @IsOptional() @IsInt() @Min(0) @Max(100)
  progress?: number;

  @IsOptional() @IsString()
  note?: string;
}
