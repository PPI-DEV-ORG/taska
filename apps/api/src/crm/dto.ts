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
  ValidateIf,
} from "class-validator";
import { PageQuery } from "../common/dto/page-query.js";

export class CrmListQuery extends PageQuery {
  @IsOptional() @IsString()
  stage?: string;

  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  leadId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  quotationId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  ownerId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  sourceId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  customerId?: number;
}

export class LeadDto {
  @IsOptional() @IsString() @MinLength(1)
  name?: string;

  @IsOptional() @IsInt()
  customerId?: number;

  @IsOptional() @IsInt()
  sourceId?: number;

  @IsOptional() @IsIn(["PARTNER", "END_USER"])
  clientType?: "PARTNER" | "END_USER";

  @IsOptional() @IsString()
  need?: string;

  @IsOptional() @IsString()
  contactName?: string;

  @IsOptional() @IsNumber()
  estimatedValue?: number;

  @IsOptional() @IsInt() @Min(0) @Max(100)
  probability?: number;

  @IsOptional() @IsDateString()
  targetClosing?: string;

  @IsOptional() @IsInt()
  ownerId?: number;

  @IsOptional() @IsBoolean()
  needsSurvey?: boolean;

  @IsOptional() @IsIn(["PROSPECTING", "QUALIFICATION", "PROPOSAL", "NEGOTIATION", "WON", "LOST"])
  stage?: "PROSPECTING" | "QUALIFICATION" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST";

  @IsOptional() @IsInt()
  lostReasonId?: number;

  @IsOptional() @IsString()
  lostNote?: string;

  @IsOptional() @IsInt()
  fileId?: number;
}

export class FollowUpDto {
  @IsOptional() @IsInt()
  leadId?: number;

  @IsOptional() @IsInt()
  quotationId?: number;

  @IsDateString()
  date!: string;

  @IsIn(["EMAIL", "TELEPON", "WA", "LAINNYA"])
  method!: "EMAIL" | "TELEPON" | "WA" | "LAINNYA";

  @IsString()
  notes!: string;

  @IsOptional() @IsDateString()
  nextDate?: string;

  @IsOptional() @IsIn(["TERJADWAL", "SELESAI"])
  status?: "TERJADWAL" | "SELESAI";
}

export class UpdateFollowUpDto {
  @IsOptional() @IsInt()
  leadId?: number;

  @IsOptional() @IsInt()
  quotationId?: number;

  @IsOptional() @IsDateString()
  date?: string;

  @IsOptional() @IsIn(["EMAIL", "TELEPON", "WA", "LAINNYA"])
  method?: "EMAIL" | "TELEPON" | "WA" | "LAINNYA";

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsDateString()
  nextDate?: string;

  @IsOptional() @IsIn(["TERJADWAL", "SELESAI"])
  status?: "TERJADWAL" | "SELESAI";
}

export class SurveyDto {
  @IsOptional() @IsInt()
  leadId?: number;

  @IsOptional() @IsString()
  location?: string;

  @IsOptional() @IsString()
  need?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsDateString()
  scheduleAt?: string;

  @IsOptional() @IsArray() @IsInt({ each: true })
  memberIds?: number[];

  @IsOptional() @IsNumber() @Min(0)
  cost?: number;

  @IsOptional() @IsIn(["DIMINTA", "DIJADWALKAN", "BERJALAN", "SELESAI", "BATAL"])
  status?: "DIMINTA" | "DIJADWALKAN" | "BERJALAN" | "SELESAI" | "BATAL";

  @IsOptional() @IsInt()
  evidenceFileId?: number;

  @IsOptional() @IsInt()
  documentFileId?: number;

  @IsOptional() @IsInt()
  fileId?: number;
}

export class SurveyStatusDto {
  @IsIn(["DIMINTA", "DIJADWALKAN", "BERJALAN", "SELESAI", "BATAL"])
  status!: "DIMINTA" | "DIJADWALKAN" | "BERJALAN" | "SELESAI" | "BATAL";

  @IsOptional() @IsDateString()
  scheduleAt?: string;

  @IsOptional() @IsString()
  notes?: string;
}

export class QuotationDto {
  @IsOptional() @IsInt()
  leadId?: number;

  @IsOptional() @IsInt()
  customerId?: number;

  @IsOptional()
  @ValidateIf((o) => o.validUntil != null && o.validUntil !== "")
  @IsDateString()
  validUntil?: string;

  @IsOptional() @IsNumber() @Min(0)
  total?: number;

  @IsOptional() @IsNumber() @Min(0)
  ppn?: number;

  @IsOptional() @IsNumber() @Min(0)
  discount?: number;

  @IsOptional() @IsNumber() @Min(0)
  grandTotal?: number;

  @IsOptional() @IsInt()
  fileId?: number;

  @IsOptional() @IsInt()
  currentVersion?: number;

  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsArray()
  items?: Array<{ id?: string; item: string; qty: number; satuan: string; harga: number }>;

  @IsOptional() @IsString()
  subject?: string;

  @IsOptional() @IsString()
  intro?: string;

  @IsOptional() @IsArray()
  notesList?: string[];

  @IsOptional() @IsString()
  city?: string;

  @IsOptional() @IsString()
  kopText?: string;

  @IsOptional() @IsString()
  customerAddress?: string;

  @IsOptional() @IsString()
  signerName?: string;

  @IsOptional() @IsString()
  signerTitle?: string;
}

export class VersionDto {
  @IsOptional() @IsInt()
  fileId?: number;

  @IsOptional() @IsNumber() @Min(0)
  total?: number;

  @IsOptional() @IsNumber() @Min(0)
  ppn?: number;

  @IsOptional() @IsNumber() @Min(0)
  discount?: number;

  @IsOptional() @IsNumber() @Min(0)
  grandTotal?: number;

  @IsOptional() @IsString()
  note?: string;
}

export class StatusDto {
  @IsString() @MinLength(1)
  status!: string;

  @IsOptional() @IsString()
  note?: string;
}
