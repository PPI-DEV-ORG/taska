import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export const CASH_ADVANCE_PURPOSES = ["SURVEY", "PENGIRIMAN", "PROJECT", "LAINNYA"] as const;
export const CASH_ADVANCE_STATUSES = ["DIAJUKAN", "DISETUJUI", "DITOLAK", "DICAIRKAN", "DILAPORKAN", "SELESAI", "DIBATALKAN"] as const;

export class CashAdvanceListQuery {
  @IsOptional() @IsIn(CASH_ADVANCE_STATUSES)
  status?: (typeof CASH_ADVANCE_STATUSES)[number];

  @IsOptional() @Type(() => Number) @IsInt()
  employeeId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  surveyId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  deliveryNoteId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  projectId?: number;

  /** "1" = hanya milik saya (pemegang / pengaju) walau saya Finance. */
  @IsOptional() @IsString()
  mine?: string;
}

export class CreateCashAdvanceDto {
  @IsIn(CASH_ADVANCE_PURPOSES)
  purpose!: (typeof CASH_ADVANCE_PURPOSES)[number];

  @IsString() @MaxLength(2000)
  description!: string;

  @Type(() => Number) @IsNumber() @Min(1)
  amount!: number;

  /** Karyawan pemegang uang; default = pengaju. */
  @IsOptional() @Type(() => Number) @IsInt()
  employeeId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  surveyId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  deliveryNoteId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  projectId?: number;

  @IsOptional() @IsString()
  neededDate?: string;
}

export class UpdateCashAdvanceDto {
  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(1)
  amount?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  employeeId?: number;

  @IsOptional() @IsString()
  neededDate?: string;
}

export class ApproveCashAdvanceDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1)
  approvedAmount?: number;
}

export class RejectCashAdvanceDto {
  @IsString() @MaxLength(1000)
  reason!: string;
}

export class DisburseCashAdvanceDto {
  /** Akun kas / bank sumber dana. */
  @IsString()
  accountCode!: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(1)
  amount?: number;

  @IsOptional() @IsIn(["TRANSFER", "TUNAI"])
  method?: "TRANSFER" | "TUNAI";

  @IsOptional() @IsString()
  date?: string;

  /** Bukti transfer / foto serah terima uang. */
  @IsOptional() @Type(() => Number) @IsInt()
  fileId?: number;

  /** Uang diserahkan ke karyawan lain (mis. admin gudang / kurir). */
  @IsOptional() @Type(() => Number) @IsInt()
  employeeId?: number;
}

export class CashAdvanceItemDto {
  @IsOptional() @IsString()
  date?: string;

  @IsString() @MaxLength(255)
  description!: string;

  @Type(() => Number) @IsNumber() @Min(1)
  amount!: number;

  @IsOptional() @Type(() => Number) @IsInt()
  categoryId?: number;

  /** Foto nota / struk. */
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsInt({ each: true })
  receiptFileIds?: number[];
}

export class SubmitReportDto {
  @IsOptional() @IsString() @MaxLength(2000)
  note?: string;
}

export class SettleCashAdvanceDto {
  /** Sisa uang: dikembalikan ke kas (RETURN) atau tetap di kantong karyawan untuk tugas berikutnya (KEEP). */
  @IsOptional() @IsIn(["RETURN", "KEEP"])
  leftoverAction?: "RETURN" | "KEEP";

  @IsOptional() @IsString()
  returnAccountCode?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  returnFileId?: number;

  /** Biaya melebihi uang jalan: dibayar dari kas (CASH) atau dipotong dari saldo kantong karyawan (WALLET). */
  @IsOptional() @IsIn(["CASH", "WALLET"])
  shortageFrom?: "CASH" | "WALLET";

  @IsOptional() @IsString()
  reimburseAccountCode?: string;
}
