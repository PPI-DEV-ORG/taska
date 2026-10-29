import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export const CAL_CATEGORIES = [
  "MEETING", "SALES", "KUNJUNGAN", "POC", "SURVEY", "PROJECT", "TASK",
  "FINANCE", "TAX", "PROCUREMENT", "OPERATIONAL", "OTHER",
] as const;
export const CAL_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "PENDING", "COMPLETED", "CANCELLED"] as const;
export const CAL_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const CAL_RECURRENCES = ["NONE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;

const upper = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim().toUpperCase().replace(/[\s-]+/g, "_") : value;

export class CalendarEventDto {
  @IsOptional() @IsString() @MinLength(2)
  title?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @Transform(upper) @IsIn(CAL_CATEGORIES as unknown as string[])
  category?: string;

  @IsOptional() @Transform(upper) @IsIn(CAL_STATUSES as unknown as string[])
  status?: string;

  @IsOptional() @Transform(upper) @IsIn(CAL_PRIORITIES as unknown as string[])
  priority?: string;

  @IsOptional() @IsDateString()
  startDate?: string;

  @IsOptional() @IsDateString()
  endDate?: string | null;

  @IsOptional() @IsBoolean()
  isAllDay?: boolean;

  @IsOptional() @Transform(upper) @IsIn(CAL_RECURRENCES as unknown as string[])
  recurrence?: string;

  @IsOptional() @IsDateString()
  recurrenceUntil?: string | null;

  @IsOptional() @Type(() => Number) @IsInt()
  reminderMinutes?: number | null;

  @IsOptional() @IsBoolean()
  remindOnCreate?: boolean;

  @IsOptional() @Type(() => Number) @IsInt()
  assigneeId?: number | null;

  @IsOptional() @IsArray() @Type(() => Number) @IsInt({ each: true })
  attendeeIds?: number[];

  @IsOptional() @IsString()
  completionNote?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  customerId?: number | null;

  @IsOptional() @Type(() => Number) @IsInt()
  projectId?: number | null;

  @IsOptional() @Type(() => Number) @IsInt()
  leadId?: number | null;

  @IsOptional() @Type(() => Number) @IsInt()
  invoiceId?: number | null;

  @IsOptional() @Type(() => Number) @IsInt()
  supplierId?: number | null;

  /** Untuk edit 1 kejadian dari seri berulang ("single" vs "series"). */
  @IsOptional() @IsIn(["single", "series"])
  occurrenceMode?: "single" | "series";

  @IsOptional() @IsString()
  occurrenceDate?: string;
}

export class CalendarStatusDto {
  @Transform(upper) @IsIn(CAL_STATUSES as unknown as string[])
  status!: string;

  @IsOptional() @IsString()
  note?: string;

  @IsOptional() @IsString()
  completionNote?: string;

  @IsOptional() @IsIn(["single", "series"])
  occurrenceMode?: "single" | "series";

  @IsOptional() @IsString()
  occurrenceDate?: string;
}

export class CalendarQuery {
  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;

  /** "me" = agenda pribadi & undangan saya, "team" = tim & project saya, "all" = semua (SUPER_ADMIN / BOS / ADMIN). */
  @IsOptional() @IsIn(["me", "team", "all"])
  scope?: "me" | "team" | "all";

  @IsOptional() @IsString()
  category?: string;

  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  assigneeId?: number;

  @IsOptional() @IsString()
  team?: string;

  @IsOptional() @IsString()
  q?: string;

  @IsOptional() @IsString()
  overdue?: string;
}
