import { IsArray, IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Max, Min, ValidateIf, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class CheckInDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  photoFileId?: number;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;

  @IsOptional()
  @IsString()
  address?: string;
}

export class CheckOutDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  overtimeHours?: number;

  @IsOptional()
  @IsNumber()
  photoFileId?: number;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;

  @IsOptional()
  @IsString()
  address?: string;
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

  @IsOptional() @IsNumber() @Min(0)
  mealAllowance?: number;

  @IsOptional() @IsBoolean()
  bpjsKes?: boolean;

  @IsOptional() @IsBoolean()
  bpjsTk?: boolean;

  @IsOptional() @IsBoolean()
  bpjsJp?: boolean;
}

/** Data karyawan (profil kepegawaian) + jabatan + pengaturan gaji dalam satu simpan. */
export class UpdateEmployeeDto {
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() employeeNo?: string;
  @IsOptional() @IsString() nik?: string;
  @IsOptional() @IsString() npwp?: string;
  @IsOptional() @IsString() birthPlace?: string;
  @IsOptional() @IsString() birthDate?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() joinDate?: string;
  @IsOptional() @IsString() employmentType?: string;
  @IsOptional() @IsString() contractEndDate?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() bankAccountNo?: string;
  @IsOptional() @IsString() bankAccountName?: string;
  @IsOptional() @IsString() bpjsKesNo?: string;
  @IsOptional() @IsString() bpjsTkNo?: string;
  @IsOptional() @IsString() emergencyName?: string;
  @IsOptional() @IsString() emergencyPhone?: string;
  @IsOptional() @ValidateNested() @Type(() => UpdateSalaryConfigDto) salary?: UpdateSalaryConfigDto;
}

/** Penyesuaian slip DRAFT: bonus / potongan / catatan. */
export class AdjustSlipDto {
  @IsOptional() @IsNumber() @Min(0) otherIncome?: number;
  @IsOptional() @IsNumber() @Min(0) otherDeduction?: number;
  @IsOptional() @IsString() note?: string;
}

export class PayPeriodDto {
  @IsString() period!: string;
  @IsOptional() @IsString() paidAccountCode?: string;
}

export class PayrollSettingsDto {
  @IsOptional() @IsNumber() @Min(1) workDays?: number;
  @IsOptional() @IsNumber() @Min(1) overtimeDivisor?: number;
  @IsOptional() @IsNumber() @Min(0) kesWageCap?: number;
  @IsOptional() @IsNumber() @Min(0) jpWageCap?: number;
  @IsOptional() @IsNumber() @Min(0) kesEmployeePct?: number;
  @IsOptional() @IsNumber() @Min(0) kesCompanyPct?: number;
  @IsOptional() @IsNumber() @Min(0) jhtEmployeePct?: number;
  @IsOptional() @IsNumber() @Min(0) jhtCompanyPct?: number;
  @IsOptional() @IsNumber() @Min(0) jpEmployeePct?: number;
  @IsOptional() @IsNumber() @Min(0) jpCompanyPct?: number;
  @IsOptional() @IsNumber() @Min(0) jkkPct?: number;
  @IsOptional() @IsNumber() @Min(0) jkmPct?: number;
  @IsOptional() @IsNumber() @Min(0) noNpwpSurchargePct?: number;
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

  @IsOptional()
  @IsString()
  paidAccountCode?: string;
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

  @IsOptional()
  @IsString()
  officeName?: string;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsNumber()
  @Min(-90)
  @Max(90)
  officeLatitude?: number | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsNumber()
  @Min(-180)
  @Max(180)
  officeLongitude?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(10)
  officeRadiusMeters?: number;

  @IsOptional()
  @IsBoolean()
  requirePhotoOnAttendance?: boolean;

  @IsOptional()
  @IsBoolean()
  requireGpsOnAttendance?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fieldRoles?: string[];
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

  @IsOptional()
  @IsString()
  verificationStatus?: "TERVERIFIKASI" | "PERLU_VERIFIKASI" | "DITOLAK";
}


