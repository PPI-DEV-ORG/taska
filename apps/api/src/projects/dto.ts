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
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { PageQuery } from "../common/dto/page-query.js";

const PROJECT_TYPES = ["CUSTOMER", "PRODUCT_RD", "INTERNAL", "MAINTENANCE", "SUPPORT", "OTHER"] as const;
const PROJECT_STATUS = ["DIRENCANAKAN", "BERJALAN", "DITUNDA", "TERLAMBAT", "SELESAI"] as const;
const TASK_STATUS = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;
const PRIORITY = ["RENDAH", "SEDANG", "TINGGI", "URGENT"] as const;

export class ProjectListQuery extends PageQuery {
  @Transform(({ value }) => {
    if (typeof value === "string") {
      const v = value.toUpperCase().trim().replace(/[\s\-]/g, "_");
      if (v === "SELESAI" || v === "DONE") return "SELESAI";
      if (v === "BERJALAN" || v === "IN_PROGRESS" || v === "AKTIF" || v === "PROGRESS") return "BERJALAN";
      if (v === "DIRENCANAKAN" || v === "PLAN" || v === "PLANNED") return "DIRENCANAKAN";
      if (v === "DITUNDA" || v === "HOLD" || v === "PENDING") return "DITUNDA";
      if (v === "TERLAMBAT" || v === "OVERDUE" || v === "LATE") return "TERLAMBAT";
      return v;
    }
    return value;
  })
  @IsOptional() @IsIn(PROJECT_STATUS)
  status?: (typeof PROJECT_STATUS)[number];

  @Transform(({ value }) => typeof value === "string" ? value.toUpperCase().trim().replace(/[\s\-]/g, "_") : value)
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
  @IsOptional() @IsString() @MinLength(1)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === "string") {
      const v = value.toUpperCase();
      if ((PROJECT_TYPES as readonly string[]).includes(v)) return v;
      if (["INSTALASI", "CUSTOMER", "PROYEK"].includes(v)) return "CUSTOMER";
      if (["MAINTENANCE", "PEMELIHARAAN"].includes(v)) return "MAINTENANCE";
      if (["SUPPORT", "DUKUNGAN"].includes(v)) return "SUPPORT";
      if (["INTERNAL"].includes(v)) return "INTERNAL";
      return "CUSTOMER";
    }
    return value;
  })
  @IsIn(PROJECT_TYPES)
  type?: (typeof PROJECT_TYPES)[number];

  @IsOptional() @IsInt()
  customerId?: number;

  @IsOptional() @IsInt()
  picId?: number;

  @IsOptional() @IsInt()
  quotationId?: number;

  @IsOptional() @IsDateString()
  startDate?: string;

  @IsOptional() @IsDateString()
  endDate?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === "string") {
      const v = value.toUpperCase().trim().replace(/[\s\-]/g, "_");
      if (v === "SELESAI" || v === "DONE") return "SELESAI";
      if (v === "BERJALAN" || v === "IN_PROGRESS" || v === "AKTIF" || v === "PROGRESS") return "BERJALAN";
      if (v === "DIRENCANAKAN" || v === "PLAN" || v === "PLANNED") return "DIRENCANAKAN";
      if (v === "DITUNDA" || v === "HOLD" || v === "PENDING") return "DITUNDA";
      if (v === "TERLAMBAT" || v === "OVERDUE" || v === "LATE") return "TERLAMBAT";
      return v;
    }
    return value;
  })
  @IsIn(PROJECT_STATUS)
  status?: (typeof PROJECT_STATUS)[number];

  @IsOptional() @IsInt() @Min(0) @Max(100)
  progress?: number;

  @IsOptional() @IsInt()
  prdFileId?: number;

  @IsOptional() @IsInt()
  bahpFileId?: number;

  @IsOptional() @IsInt()
  bastFileId?: number;

  @IsOptional() @IsInt()
  doFileId?: number;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsArray() @IsInt({ each: true })
  memberIds?: number[];
}

export class ProjectStatusDto {
  @Transform(({ value }) => {
    if (typeof value === "string") {
      const v = value.toUpperCase().trim().replace(/[\s\-]/g, "_");
      if (v === "SELESAI" || v === "DONE") return "SELESAI";
      if (v === "BERJALAN" || v === "IN_PROGRESS" || v === "AKTIF" || v === "PROGRESS") return "BERJALAN";
      if (v === "DIRENCANAKAN" || v === "PLAN" || v === "PLANNED") return "DIRENCANAKAN";
      if (v === "DITUNDA" || v === "HOLD" || v === "PENDING") return "DITUNDA";
      if (v === "TERLAMBAT" || v === "OVERDUE" || v === "LATE") return "TERLAMBAT";
      return v;
    }
    return value;
  })
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

  @IsOptional() @IsString()
  serials?: string;
}

export class ReturnMaterialItemDto {
  @Type(() => Number) @IsInt()
  productId!: number;

  @Type(() => Number) @IsInt() @Min(1)
  qty!: number;

  @IsOptional() @IsArray()
  serials?: string[];

  @IsOptional() @IsString()
  note?: string;
}

export class ReturnMaterialsDto {
  @Type(() => Number) @IsInt()
  warehouseId!: number;

  @IsArray() @ValidateNested({ each: true }) @Type(() => ReturnMaterialItemDto)
  items!: ReturnMaterialItemDto[];

  @IsOptional() @IsString()
  reason?: string;
}

export class TaskDto {
  @IsOptional() @IsString() @MinLength(1)
  name?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsInt()
  parentId?: number;

  @IsOptional() @IsInt()
  assigneeId?: number;

  @IsOptional() @IsDateString()
  dueDate?: string;

  @Transform(({ value }) => {
    if (typeof value === "string") {
      const v = value.toUpperCase().trim().replace(/[\s\-]/g, "_");
      if (v === "LOW") return "RENDAH";
      if (v === "MEDIUM" || v === "MED") return "SEDANG";
      if (v === "HIGH") return "TINGGI";
      if (v === "URGENT") return "URGENT";
      return v;
    }
    return value;
  })
  @IsOptional() @IsIn(PRIORITY)
  priority?: (typeof PRIORITY)[number];

  @Transform(({ value }) => {
    if (typeof value === "string") {
      const v = value.toUpperCase().trim().replace(/[\s\-]/g, "_");
      if (v === "TODO") return "TODO";
      if (v === "IN_PROGRESS" || v === "PROGRESS" || v === "BERJALAN" || v === "DOING") return "IN_PROGRESS";
      if (v === "BLOCKED" || v === "HOLD" || v === "TERTUNDA" || v === "PENDING") return "BLOCKED";
      if (v === "DONE" || v === "SELESAI" || v === "COMPLETED") return "DONE";
      return v;
    }
    return value;
  })
  @IsOptional() @IsIn(TASK_STATUS)
  status?: (typeof TASK_STATUS)[number];

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
  @Transform(({ value }) => {
    if (typeof value === "string") {
      const v = value.toUpperCase().trim().replace(/[\s\-]/g, "_");
      if (v === "TODO") return "TODO";
      if (v === "IN_PROGRESS" || v === "PROGRESS" || v === "BERJALAN" || v === "DOING") return "IN_PROGRESS";
      if (v === "BLOCKED" || v === "HOLD" || v === "TERTUNDA" || v === "PENDING") return "BLOCKED";
      if (v === "DONE" || v === "SELESAI" || v === "COMPLETED") return "DONE";
      return v;
    }
    return value;
  })
  @IsIn(TASK_STATUS)
  status!: (typeof TASK_STATUS)[number];

  @IsOptional() @IsInt() @Min(0) @Max(100)
  progress?: number;

  @IsOptional() @IsString()
  note?: string;
}
