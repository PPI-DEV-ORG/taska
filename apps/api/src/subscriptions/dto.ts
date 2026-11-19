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

export const BILLING_CYCLES = [
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "ANNUAL",
  "BIENNIAL",
  "CUSTOM",
] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const SUBSCRIPTION_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "ACTIVE",
  "RENEWAL_DUE",
  "RENEWAL_PENDING",
  "SUSPENDED",
  "EXPIRED",
  "CANCELLATION_PENDING",
  "CANCELLED",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
  "REFUNDED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const CHANGE_TYPES = ["UPGRADE", "DOWNGRADE", "PRICE_ADJUSTMENT"] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

export const UTILIZATION_STATUSES = [
  "ACTIVE_BUT_UNUSED",
  "UNDERUTILIZED",
  "OPTIMAL",
  "OVER_CAPACITY",
  "PENDING_REVIEW",
] as const;
export type UtilizationStatus = (typeof UTILIZATION_STATUSES)[number];

export const REMINDER_TYPES = ["H-30", "H-14", "H-7", "H-3", "H-1", "H+1"] as const;

export const DOCUMENT_TYPES = [
  "CONTRACT",
  "INVOICE",
  "RECEIPT",
  "LICENSE",
  "PROOF",
  "CONFIRMATION",
] as const;

export const CANCELLATION_STATUSES = ["PENDING", "APPROVED", "EXECUTED", "REJECTED"] as const;

const toNumber = ({ value }: { value: unknown }) =>
  value === "" || value === null || value === undefined ? undefined : Number(value);
const toBool = ({ value }: { value: unknown }) => {
  if (value === "" || value === null || value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  return value === "true" || value === "1" || value === 1;
};
const toInt = ({ value }: { value: unknown }) =>
  value === "" || value === null || value === undefined ? undefined : Number(value);

export class SubscriptionCategoryDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  subcategory?: string;

  @IsOptional()
  @IsIn(BILLING_CYCLES)
  defaultBillingCycle?: string = "ANNUAL";

  @IsOptional()
  @IsString()
  expenseAccountCode?: string = "6122";

  @IsOptional()
  @IsString()
  prepaidAccountCode?: string = "1401";

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class SubscriptionProviderDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  supportEmail?: string;

  @IsOptional()
  @IsString()
  supportPhone?: string;

  @IsOptional()
  @IsString()
  loginPortalUrl?: string;

  @IsOptional()
  @IsString()
  accountRepresentative?: string;

  @IsOptional()
  @IsBoolean()
  isSeeded?: boolean;
}

export class CostAllocationDto {
  @IsString()
  @MinLength(1)
  department!: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  projectId?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  percentage!: number;
}

export class CreateSubscriptionDto {
  @IsString()
  @MinLength(2)
  serviceName!: string;

  @Type(() => Number)
  @IsInt()
  categoryId!: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  providerId?: number;

  @IsOptional()
  @IsString()
  providerName?: string;

  @IsOptional()
  @IsString()
  accountIdentifier?: string;

  @IsOptional()
  @IsString()
  serviceUrl?: string;

  @IsOptional()
  @IsString()
  subscriptionPlan?: string;

  @IsOptional()
  @IsIn(BILLING_CYCLES)
  billingCycle?: string = "ANNUAL";

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @IsOptional()
  @IsDateString()
  nextRenewalDate?: string;

  @IsOptional()
  @IsBoolean()
  autoRenewal?: boolean = false;

  @IsOptional()
  @IsString()
  currency?: string = "IDR";

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cost!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tax?: number = 0;

  @IsOptional()
  @IsString()
  originalCurrency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  originalAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  exchangeRate?: number;

  @IsOptional()
  @IsDateString()
  exchangeRateDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  idrEquivalent?: number;

  @IsString()
  @MinLength(1)
  department!: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  picUserId?: number;

  @IsString()
  @MinLength(2)
  businessPurpose!: string;

  @IsOptional()
  @IsIn(SUBSCRIPTION_STATUSES)
  status?: string = "ACTIVE";

  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  paymentStatus?: string = "UNPAID";

  @IsOptional()
  @IsString()
  expenseAccountCode?: string;

  @IsOptional()
  @IsString()
  prepaidAccountCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  paymentInvoiceNumber?: string;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  paymentAccountCode?: string;

  @IsOptional()
  @IsString()
  paymentInvoiceFileUrl?: string;

  @IsOptional()
  @IsString()
  paymentProofUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CostAllocationDto)
  allocations?: CostAllocationDto[];
}

export class UpdateSubscriptionDto {
  @IsOptional() @IsString() @MinLength(2) serviceName?: string;
  @IsOptional() @Type(() => Number) @IsInt() categoryId?: number;
  @IsOptional() @Transform(toInt) @IsInt() providerId?: number | null;
  @IsOptional() @IsString() providerName?: string;
  @IsOptional() @IsString() accountIdentifier?: string;
  @IsOptional() @IsString() serviceUrl?: string;
  @IsOptional() @IsString() subscriptionPlan?: string;
  @IsOptional() @IsIn(BILLING_CYCLES) billingCycle?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() expirationDate?: string;
  @IsOptional() @IsDateString() nextRenewalDate?: string;
  @IsOptional() @IsBoolean() autoRenewal?: boolean;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) cost?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) tax?: number;
  @IsOptional() @IsString() originalCurrency?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) originalAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) exchangeRate?: number;
  @IsOptional() @IsDateString() exchangeRateDate?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) idrEquivalent?: number;
  @IsOptional() @IsString() @MinLength(1) department?: string;
  @IsOptional() @Transform(toInt) @IsInt() picUserId?: number | null;
  @IsOptional() @IsString() @MinLength(2) businessPurpose?: string;
  @IsOptional() @IsIn(SUBSCRIPTION_STATUSES) status?: string;
  @IsOptional() @IsIn(PAYMENT_STATUSES) paymentStatus?: string;
  @IsOptional() @IsString() paymentInvoiceNumber?: string;
  @IsOptional() @IsDateString() paymentDate?: string;
  @IsOptional() @IsString() paymentAccountCode?: string;
  @IsOptional() @IsString() paymentInvoiceFileUrl?: string;
  @IsOptional() @IsString() paymentProofUrl?: string;
  @IsOptional() @IsString() expenseAccountCode?: string;
  @IsOptional() @IsString() prepaidAccountCode?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CostAllocationDto) allocations?: CostAllocationDto[];
}

export class SubscriptionQuery extends PageQuery {
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() providerId?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() paymentStatus?: string;
  @IsOptional() @IsString() billingCycle?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() picUserId?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
  @IsOptional() @IsString() dueInDays?: string;
}

export class RenewSubscriptionDto {
  @IsDateString()
  newPeriodStart!: string;

  @IsDateString()
  newPeriodEnd!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  renewalCost!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  renewalTax?: number;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(["PENDING", "APPROVED"])
  approvalStatus?: string = "APPROVED";
}

export class ChangeSubscriptionPlanDto {
  @IsIn(CHANGE_TYPES)
  changeType!: string;

  @IsString()
  @MinLength(1)
  newPlan!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  newCost!: number;

  @IsDateString()
  effectiveDate!: string;

  @IsString()
  @MinLength(2)
  changeReason!: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  approvedByUserId?: number;
}

export class SubscriptionPaymentDto {
  @IsOptional() @IsString() invoiceNumber?: string;
  @IsOptional() @IsDateString() invoiceDate?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsDateString() paymentDate?: string;
  @IsOptional() @IsString() billingPeriod?: string;
  @Type(() => Number) @IsNumber() @Min(0) amount!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) tax?: number = 0;
  @IsOptional() @IsString() currency?: string = "IDR";
  @IsOptional() @IsIn(PAYMENT_STATUSES) paymentStatus?: string = "PAID";
  @IsOptional() @Type(() => Number) @IsInt() financeJournalId?: number;
  @IsOptional() @IsString() invoiceFileUrl?: string;
  @IsOptional() @IsString() paymentProofUrl?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() postJournal?: boolean = false;
  @IsOptional() @IsString() fundingAccountCode?: string = "1000.02";
  @IsOptional() @IsIn(["CASH", "AP"]) fundingType?: string = "CASH";
  @IsOptional() @IsBoolean() prepaid?: boolean;
}

export class PrepaidGenerateDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) totalAmount?: number;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
}

export class PostPrepaidDto {
  @Type(() => Number) @IsInt() periodYear!: number;
  @Type(() => Number) @IsInt() periodMonth!: number;
  @IsOptional() @IsArray() @IsInt({ each: true }) scheduleIds?: number[];
}

export class CancellationRequestDto {
  @IsString() @MinLength(2) reason!: string;
  @IsDateString() effectiveCancellationDate!: string;
  @IsOptional() @IsDateString() finalBillingDate?: string;
  @IsOptional() @IsBoolean() isDataBackupConfirmed?: boolean = false;
  @IsOptional() @IsBoolean() isServiceMigrationConfirmed?: boolean = false;
  @IsOptional() @IsBoolean() isDnsMigrationConfirmed?: boolean = false;
  @IsOptional() @IsBoolean() isDependencyCheckConfirmed?: boolean = false;
  @IsOptional() @IsBoolean() isHandoverConfirmed?: boolean = false;
  @IsOptional() @IsBoolean() isTerminationConfirmed?: boolean = false;
  @IsOptional() @IsString() notes?: string;
}

export class CancellationDecisionDto {
  @IsIn(["APPROVED", "REJECTED", "EXECUTED"])
  status!: string;

  @IsOptional() @IsString() notes?: string;
}

export class UsageReviewDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) usersCount?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) licensesCount?: number;
  @IsOptional() @IsString() storageCapacity?: string;
  @IsOptional() @IsString() serverSpecs?: string;
  @IsOptional() @IsIn(UTILIZATION_STATUSES) utilizationStatus?: string = "OPTIMAL";
  @IsOptional() @IsString() evaluationNotes?: string;
  @IsOptional() @IsDateString() lastReviewedDate?: string;
}

export class SubscriptionDocumentDto {
  @IsString() @MinLength(1) title!: string;
  @IsIn(DOCUMENT_TYPES) documentType!: string;
  @IsString() @MinLength(1) fileUrl!: string;
  @IsOptional() @Type(() => Number) @IsInt() fileSize?: number;
  @IsOptional() @IsString() mimeType?: string;
}

export class RunRemindersDto {
  @IsOptional() @IsDateString() asOfDate?: string;
}

export class SubscriptionReportQuery extends PageQuery {
  @IsOptional() @IsString() report?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
  @IsOptional() @IsString() providerId?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() currency?: string;
}

export class ConfirmBillingDraftDto {
  @IsOptional() @IsBoolean() postJournal?: boolean = false;
}
