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
  ValidateNested,
} from "class-validator";
import { PageQuery } from "../common/dto/page-query.js";

export const CONTRACT_STATUSES = [
  "ACTIVE",
  "EXPIRING_SOON",
  "RENEWAL_PENDING",
  "EXPIRED",
  "TERMINATED",
  "RENEWED",
] as const;

export const APPROVAL_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "REVISION_REQUIRED",
  "CANCELLED",
] as const;

export const COUNTERPARTY_TYPES = [
  "VENDOR",
  "CUSTOMER",
  "INTERNAL",
  "THIRD_PARTY",
] as const;

export const PAYMENT_FREQUENCIES = [
  "ONE_TIME",
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "ANNUAL",
  "MILESTONE",
  "CUSTOM",
] as const;

export const VALUE_TYPES = [
  "FIXED",
  "MONTHLY_RECURRING",
  "ANNUAL_RECURRING",
  "ONE_TIME",
  "VARIABLE",
  "MILESTONE",
] as const;

export const DOCUMENT_CATEGORIES = [
  "MAIN_CONTRACT",
  "PURCHASE_AGREEMENT",
  "SERVICE_AGREEMENT",
  "MOU",
  "NDA",
  "ADDENDUM",
  "QUOTATION",
  "BERITA_ACARA",
  "LEGALITY",
  "SUPPORTING",
] as const;

const toNumber = ({ value }: { value: unknown }) =>
  value === "" || value === null || value === undefined ? undefined : Number(value);

const toInt = ({ value }: { value: unknown }) =>
  value === "" || value === null || value === undefined ? undefined : Number.parseInt(String(value), 10);

const toBool = ({ value }: { value: unknown }) => {
  if (value === "" || value === null || value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  return value === "true" || value === "1" || value === 1;
};

export class ContractTypeDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isActive?: boolean = true;
}

export class ContractPartyInputDto {
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  id?: number;

  @IsOptional()
  @IsString()
  partyType?: string = "SECOND_PARTY";

  @IsOptional()
  @IsString()
  entityType?: string = "OTHER";

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  entityId?: number;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  picName?: string;

  @IsOptional()
  @IsString()
  picEmail?: string;

  @IsOptional()
  @IsString()
  picPhone?: string;
}

export class ContractServiceInputDto {
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  id?: number;

  @IsString()
  @MinLength(1)
  serviceName!: string;

  @IsOptional()
  @IsString()
  serviceScope?: string;

  @IsOptional()
  @IsString()
  servicePeriod?: string;

  @IsOptional()
  @IsString()
  serviceLocation?: string;

  @IsOptional()
  @IsString()
  supportContact?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  serviceFee?: number;

  @IsOptional()
  @IsString()
  penaltyClause?: string;

  @IsOptional()
  @IsString()
  renewalTerms?: string;
}

export class ContractSlaInputDto {
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  id?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  serviceId?: number;

  @IsString()
  @MinLength(1)
  indicatorName!: string;

  @IsString()
  @MinLength(1)
  targetMetric!: string;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  responseHours?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  resolutionHours?: number;

  @IsOptional()
  @IsString()
  penaltyDetails?: string;

  @IsOptional()
  @IsString()
  operationalHours?: string = "8x5";
}

export class ContractTermInputDto {
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  id?: number;

  @IsOptional()
  @IsString()
  termType?: string = "GENERAL";

  @IsOptional()
  @IsString()
  clauseNumber?: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  content!: string;
}

export class ContractFinancialInputDto {
  @IsOptional()
  @IsString()
  valueType?: string = "FIXED";

  @IsOptional()
  @IsString()
  currency?: string = "IDR";

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  baseAmount?: number = 0;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  taxPercentage?: number = 0;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  taxAmount?: number = 0;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  totalAmount?: number = 0;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  downPaymentAmount?: number = 0;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  retentionAmount?: number = 0;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(0)
  retentionPeriodDays?: number;

  @IsOptional()
  @IsString()
  penaltyTerms?: string;

  @IsOptional()
  @IsString()
  costCenter?: string;

  @IsOptional()
  @IsString()
  projectReference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ContractPaymentScheduleInputDto {
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  id?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  scheduleNumber?: number = 1;

  @IsString()
  @MinLength(1)
  milestoneName!: string;

  @IsString()
  dueDate!: string;

  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  taxAmount?: number = 0;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @IsOptional()
  @IsString()
  paymentStatus?: string = "PLANNED";

  @IsOptional()
  @IsString()
  invoiceReference?: string;

  @IsOptional()
  @IsString()
  paidDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ContractRelationInputDto {
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  id?: number;

  @IsString()
  @MinLength(2)
  relatedModule!: string;

  @Transform(toInt)
  @IsInt()
  relatedId!: number;

  @IsOptional()
  @IsString()
  referenceCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateContractDto {
  @IsOptional()
  @IsString()
  officialNumber?: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @Transform(toInt)
  @IsInt()
  typeId!: number;

  @IsOptional()
  @IsString()
  counterpartyType?: string = "VENDOR";

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  counterpartyId?: number;

  @IsString()
  @MinLength(1)
  counterpartyName!: string;

  @IsString()
  effectiveDate!: string;

  @IsString()
  expirationDate!: string;

  @IsOptional()
  @IsString()
  renewalDate?: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isAutoRenewal?: boolean = false;

  @IsOptional()
  @IsString()
  currency?: string = "IDR";

  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  contractValue!: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  contractOwnerId?: number;

  @IsString()
  @MinLength(1)
  department!: string;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  paymentFrequency?: string = "ONE_TIME";

  @IsOptional()
  @IsString()
  status?: string = "ACTIVE";

  @IsOptional()
  @IsString()
  approvalStatus?: string = "DRAFT";

  @IsOptional()
  @IsString()
  description?: string;

  // Initial document attachment during creation
  @IsOptional()
  @IsString()
  initialDocumentTitle?: string;

  @IsOptional()
  @IsString()
  initialDocumentCategory?: string = "MAIN_CONTRACT";

  @IsOptional()
  @IsString()
  initialDocumentNumber?: string;

  @IsOptional()
  @IsString()
  initialDocumentUrl?: string;

  @IsOptional()
  @IsString()
  initialDocumentFileName?: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  initialDocumentFileSize?: number;

  @IsOptional()
  @IsString()
  initialDocumentMimeType?: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  initialDocumentConfidential?: boolean = false;

  @IsOptional()
  @IsString()
  initialDocumentSignedDate?: string;

  @IsOptional()
  @IsString()
  initialDocumentSignedByFirst?: string;

  @IsOptional()
  @IsString()
  initialDocumentSignedBySecond?: string;

  // Nested arrays
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractPartyInputDto)
  parties?: ContractPartyInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractServiceInputDto)
  services?: ContractServiceInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractSlaInputDto)
  slas?: ContractSlaInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractTermInputDto)
  terms?: ContractTermInputDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ContractFinancialInputDto)
  financial?: ContractFinancialInputDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractPaymentScheduleInputDto)
  paymentSchedules?: ContractPaymentScheduleInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractRelationInputDto)
  relations?: ContractRelationInputDto[];
}

export class UpdateContractDto {
  @IsOptional()
  @IsString()
  officialNumber?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  typeId?: number;

  @IsOptional()
  @IsString()
  counterpartyType?: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  counterpartyId?: number;

  @IsOptional()
  @IsString()
  counterpartyName?: string;

  @IsOptional()
  @IsString()
  effectiveDate?: string;

  @IsOptional()
  @IsString()
  expirationDate?: string;

  @IsOptional()
  @IsString()
  renewalDate?: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isAutoRenewal?: boolean;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  contractValue?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  contractOwnerId?: number;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  paymentFrequency?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  approvalStatus?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractPartyInputDto)
  parties?: ContractPartyInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractServiceInputDto)
  services?: ContractServiceInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractSlaInputDto)
  slas?: ContractSlaInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractTermInputDto)
  terms?: ContractTermInputDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ContractFinancialInputDto)
  financial?: ContractFinancialInputDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractPaymentScheduleInputDto)
  paymentSchedules?: ContractPaymentScheduleInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractRelationInputDto)
  relations?: ContractRelationInputDto[];
}

export class ContractDocumentDto {
  @IsString()
  @MinLength(2)
  documentTitle!: string;

  @IsOptional()
  @IsString()
  documentCategory?: string = "MAIN_CONTRACT";

  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isConfidential?: boolean = false;

  @IsOptional()
  @IsString()
  signedDate?: string;

  @IsOptional()
  @IsString()
  signedByFirstParty?: string;

  @IsOptional()
  @IsString()
  signedBySecondParty?: string;

  @IsString()
  @MinLength(1)
  fileUrl!: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  fileId?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  fileSize?: number;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  changeSummary?: string;
}

export class ContractDocumentVersionDto {
  @IsString()
  @MinLength(1)
  fileUrl!: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  fileId?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  fileSize?: number;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  changeSummary?: string;
}

export class ContractApprovalDecisionDto {
  @IsOptional()
  @IsString()
  stage?: string = "DIRECTOR_APPROVAL";

  @IsString()
  @IsIn(["PENDING_REVIEW", "PENDING_APPROVAL", "APPROVED", "REJECTED", "REVISION_REQUIRED", "CANCELLED"])
  decision!: string;

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  approvedDocumentVersionId?: number;
}

export class ContractRenewalRequestDto {
  @IsOptional()
  @IsString()
  submissionDate?: string;

  @IsString()
  proposedEffectiveDate!: string;

  @IsString()
  proposedExpirationDate!: string;

  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  proposedValue!: number;

  @IsString()
  @MinLength(2)
  reason!: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  autoApprove?: boolean = false;

  @IsOptional()
  @IsString()
  reviewComments?: string;

  // Optional draft addendum upload
  @IsOptional()
  @IsString()
  addendumTitle?: string;

  @IsOptional()
  @IsString()
  addendumFileUrl?: string;

  @IsOptional()
  @IsString()
  addendumFileName?: string;
}

export class ContractRenewalDecisionDto {
  @IsString()
  @IsIn(["APPROVED", "REJECTED", "CANCELLED"])
  decision!: string;

  @IsOptional()
  @IsString()
  reviewComments?: string;
}

export class ContractAmendmentDto {
  @IsOptional()
  @IsString()
  amendmentNumber?: string;

  @IsString()
  amendmentDate!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  @MinLength(2)
  description!: string;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  valueAdjustment?: number = 0;

  @IsOptional()
  @IsString()
  newEffectiveDate?: string;

  @IsOptional()
  @IsString()
  newExpirationDate?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  fileName?: string;
}

export class ContractTerminationDto {
  @IsString()
  terminationDate!: string;

  @IsString()
  @MinLength(2)
  reason!: string;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  penaltyAmount?: number = 0;

  @IsOptional()
  @IsString()
  remainingObligations?: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  checklistConfirmed?: boolean = false;

  @IsOptional()
  @IsString()
  beritaAcaraFileUrl?: string;

  @IsOptional()
  @IsString()
  beritaAcaraFileName?: string;
}

export class RunContractRemindersDto {
  @IsOptional()
  @IsString()
  asOfDate?: string;
}

export class ContractQuery extends PageQuery {
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  typeId?: number;

  @IsOptional()
  @IsString()
  typeCode?: string;

  @IsOptional()
  @IsString()
  counterpartyType?: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  counterpartyId?: number;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  approvalStatus?: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  ownerId?: number;

  @IsOptional()
  @IsString()
  tab?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}

export class ContractReportQuery {
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  typeId?: number;

  @IsOptional()
  @IsString()
  counterpartyName?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  approvalStatus?: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  ownerId?: number;
}
