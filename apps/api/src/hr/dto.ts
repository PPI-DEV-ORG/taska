import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateIf } from "class-validator";
import { Type } from "class-transformer";

export class CheckInDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CheckOutDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  overtimeHours?: number;
}

export class RecordAttendanceDto {
  @IsNumber()
  userId: number;

  @IsDateString()
  date: string;

  @IsString()
  status: "HADIR" | "IZIN" | "SAKIT" | "CUTI" | "ALPHA";

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  overtimeHours?: number;
}

export class UpdateSalaryConfigDto {
  @IsNumber()
  @Min(0)
  basicSalary: number;

  @IsNumber()
  @Min(0)
  allowance: number;

  @IsOptional()
  @IsString()
  ptkp?: string;

  @IsOptional()
  @IsBoolean()
  hasNpwp?: boolean;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsNumber()
  pph21Rate?: number | null;
}

export class SaveSalaryConfigDto extends UpdateSalaryConfigDto {
  @IsNumber()
  userId: number;
}

export class GeneratePayrollDto {
  @IsString()
  period: string; // "YYYY-MM"
}

export class PaySlipDto {
  @IsOptional()
  @IsString()
  paymentMethod?: string; // "BANK" | "KAS"
}

export class WorkScheduleSettingsDto {
  @IsOptional()
  @IsString()
  workStartTime?: string; // "08:00"

  @IsOptional()
  @IsString()
  workEndTime?: string; // "17:00"

  @IsOptional()
  @IsNumber()
  @Min(0)
  lateToleranceMinutes?: number; // 15

  @IsOptional()
  @IsString()
  breakStartTime?: string; // "12:00"

  @IsOptional()
  @IsString()
  breakEndTime?: string; // "13:00"

  @IsOptional()
  @IsString()
  overtimeCalculationMode?: "AFTER_HOURS" | "AFTER_WORK_END";

  @IsOptional()
  @IsNumber()
  @Min(0)
  overtimeThresholdHours?: number; // 8

  @IsOptional()
  @IsNumber()
  @Min(0)
  overtimeMinMinutes?: number; // 30

  @IsOptional()
  @IsNumber()
  @Min(0)
  overtimeRatePerHour?: number; // 25000
}

export class UpdateAttendanceDto {
  @IsOptional()
  @IsString()
  status?: "HADIR" | "IZIN" | "SAKIT" | "CUTI" | "ALPHA";

  @IsOptional()
  @IsNumber()
  @Min(0)
  overtimeHours?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}


