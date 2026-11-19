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
  MinLength,
} from "class-validator";
import { PageQuery } from "../common/dto/page-query.js";

// ────────────────────────────── Legacy Maintenance Report DTOs (Preserved) ──────────────────────────────
export const MAINTENANCE_STATUSES = [
  "Scheduled",
  "In_Progress",
  "Completed",
  "Cancelled",
] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const ACTION_STATUSES = ["Open", "In Progress", "Done"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export class MaintenanceReportDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @IsOptional()
  @IsString()
  maintenanceType?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return value;
    const str = String(value).trim().toLowerCase().replace(/[\s\-]+/g, "_");
    if (str === "scheduled" || str === "terjadwal" || str === "planned") return "Scheduled";
    if (str === "in_progress" || str === "sedang_dikerjakan" || str === "berjalan") return "In_Progress";
    if (str === "completed" || str === "selesai") return "Completed";
    if (str === "cancelled" || str === "batal" || str === "dibatalkan") return "Cancelled";
    return value;
  })
  @IsIn(MAINTENANCE_STATUSES)
  status?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsString()
  clientContact?: string;

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
  purpose?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  findings?: string;

  @IsOptional()
  @IsString()
  actionsTaken?: string;

  @IsOptional()
  @IsString()
  recommendations?: string;

  @IsOptional()
  @IsString()
  conclusion?: string;

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
  @Type(() => Number)
  @IsInt()
  ownerId?: number;

  @IsOptional()
  @IsArray()
  memberIds?: number[];
}

export class MaintenanceStatusDto {
  @Transform(({ value }) => {
    if (!value) return value;
    const str = String(value).trim().toLowerCase().replace(/[\s\-]+/g, "_");
    if (str === "scheduled" || str === "terjadwal" || str === "planned") return "Scheduled";
    if (str === "in_progress" || str === "sedang_dikerjakan" || str === "berjalan") return "In_Progress";
    if (str === "completed" || str === "selesai") return "Completed";
    if (str === "cancelled" || str === "batal" || str === "dibatalkan") return "Cancelled";
    return value;
  })
  @IsIn(MAINTENANCE_STATUSES)
  status!: string;
}

export class MaintenanceActionItemDto {
  @IsString()
  @MinLength(3)
  task!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assigneeId?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsIn(ACTION_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class MaintenanceListQuery extends PageQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageSize?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  maintenanceType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectId?: number;

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
  ownerId?: number;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

// ────────────────────────────── New EAM / CMMS DTOs ──────────────────────────────

export class CreateMaintCategoryDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMaintCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateChecklistItemDto {
  @IsString()
  itemText!: string;

  @IsOptional()
  @IsString()
  standardCondition?: string;

  @IsOptional()
  @IsInt()
  sequence?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

export class CreateMaintChecklistDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @Type(() => Number)
  @IsInt()
  categoryId!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  items?: CreateChecklistItemDto[];
}

export class UpdateMaintChecklistDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  items?: CreateChecklistItemDto[];
}

export class CreateMaintVendorDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rating?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMaintVendorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rating?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateMaintPlanDto {
  @IsString()
  title!: string;

  @Type(() => Number)
  @IsInt()
  categoryId!: number;

  @IsOptional()
  @IsString()
  method?: string; // CALENDAR_BASED, USAGE_BASED, CONDITION_BASED, MANUAL

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  intervalValue?: number;

  @IsOptional()
  @IsString()
  intervalUnit?: string; // DAYS, WEEKS, MONTHS, YEARS, KM, HOURS

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  checklistId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  picUserId?: number;

  @IsOptional()
  @IsBoolean()
  autoGenerate?: boolean;

  @IsOptional()
  @IsString()
  generationHorizon?: string; // NEXT_CYCLE, 3_MONTHS, 6_MONTHS, 1_YEAR

  @IsOptional()
  @IsString()
  reminderLeadDays?: string; // "14,7,3,1"

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  assetIds?: number[];
}

export class UpdateMaintPlanDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  intervalValue?: number;

  @IsOptional()
  @IsString()
  intervalUnit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  checklistId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  picUserId?: number;

  @IsOptional()
  @IsBoolean()
  autoGenerate?: boolean;

  @IsOptional()
  @IsString()
  generationHorizon?: string;

  @IsOptional()
  @IsString()
  reminderLeadDays?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  assetIds?: number[];
}

export class GenerateSchedulesDto {
  @IsOptional()
  @IsString()
  horizon?: string; // NEXT_CYCLE, 3_MONTHS, 6_MONTHS, 1_YEAR

  @IsOptional()
  @IsArray()
  assetIds?: number[];
}

export class RescheduleScheduleDto {
  @IsDateString()
  newDate!: string;

  @IsString()
  reason!: string;
}

export class CreateMaintRequestDto {
  @Type(() => Number)
  @IsInt()
  assetId!: number;

  @IsDateString()
  requestDate!: string;

  @IsString()
  problemDescription!: string;

  @IsOptional()
  @IsString()
  urgency?: string; // LOW, MEDIUM, HIGH, CRITICAL

  @IsOptional()
  @IsArray()
  attachments?: { fileUrl: string; fileId?: number; title?: string }[];
}

export class UpdateMaintRequestDto {
  @IsOptional()
  @IsInt()
  assetId?: number;

  @IsOptional()
  @IsDateString()
  requestDate?: string;

  @IsOptional()
  @IsString()
  problemDescription?: string;

  @IsOptional()
  @IsString()
  urgency?: string;
}

export class InitialInspectRequestDto {
  @IsString()
  initialInspectionNotes!: string;

  @IsOptional()
  @IsIn(["APPROVED", "REJECTED"])
  decision?: "APPROVED" | "REJECTED";

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class CreateMaintWorkOrderDto {
  @Type(() => Number)
  @IsInt()
  assetId!: number;

  @IsOptional()
  @IsString()
  maintenanceType?: string; // PREVENTIVE, CORRECTIVE

  @IsOptional()
  @IsString()
  priority?: string; // LOW, MEDIUM, HIGH, CRITICAL

  @IsString()
  problemDescription!: string;

  @IsOptional()
  @IsString()
  workInstruction?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assignedToUserId?: number;

  @IsOptional()
  @IsDateString()
  plannedStartDate?: string;

  @IsOptional()
  @IsDateString()
  plannedFinishDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  requestId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  scheduleId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  checklistId?: number;
}

export class UpdateMaintWorkOrderDto {
  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  problemDescription?: string;

  @IsOptional()
  @IsString()
  workInstruction?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assignedToUserId?: number;

  @IsOptional()
  @IsDateString()
  plannedStartDate?: string;

  @IsOptional()
  @IsDateString()
  plannedFinishDate?: string;

  @IsOptional()
  @IsDateString()
  actualStartDate?: string;

  @IsOptional()
  @IsDateString()
  actualFinishDate?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  workResult?: string;

  @IsOptional()
  @IsString()
  rootCause?: string;

  @IsOptional()
  @IsString()
  correctiveAction?: string;
}

export class AssignWorkOrderDto {
  @Type(() => Number)
  @IsInt()
  assignedToUserId!: number;

  @IsOptional()
  @IsString()
  workInstruction?: string;
}

export class UpdateWorkOrderStatusDto {
  @IsString()
  status!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddWorkOrderTaskDto {
  @IsString()
  taskName!: string;

  @IsOptional()
  @IsString()
  instruction?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sequence?: number;
}

export class UpdateWorkOrderTaskDto {
  @IsOptional()
  @IsString()
  taskName?: string;

  @IsOptional()
  @IsString()
  instruction?: string;

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateWorkOrderChecklistDto {
  @IsOptional()
  @IsString()
  conditionBefore?: string;

  @IsOptional()
  @IsString()
  conditionAfter?: string;

  @IsOptional()
  @IsIn(["PASS", "FAIL", "NEEDS_ATTENTION"])
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddWorkOrderMaterialDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;

  @IsString()
  sparePartName!: string;

  @IsOptional()
  @IsString()
  partNumber?: string;

  @Type(() => Number)
  @IsNumber()
  quantity!: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @Type(() => Number)
  @IsNumber()
  unitCost!: number;

  @IsOptional()
  @IsString()
  source?: string; // WAREHOUSE, DIRECT_PURCHASE

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  warehouseId?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddWorkOrderLaborDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  technicianUserId?: number;

  @IsString()
  technicianName!: string;

  @Type(() => Number)
  @IsNumber()
  hoursSpent!: number;

  @Type(() => Number)
  @IsNumber()
  hourlyRate!: number;

  @IsOptional()
  @IsString()
  workDescription?: string;

  @IsOptional()
  @IsDateString()
  loggedDate?: string;
}

export class AddWorkOrderCostDto {
  @IsString()
  costComponent!: string; // SPARE_PART, LABOR, EXTERNAL_SERVICE, TRANSPORTATION, OTHER

  @IsString()
  description!: string;

  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  sourceTransactionType?: string; // CASH_BANK, INVOICE, WAREHOUSE, EXPENSE, MANUAL

  @IsOptional()
  @IsString()
  sourceTransactionRef?: string;

  @IsOptional()
  @IsBoolean()
  isCapitalized?: boolean;

  @IsOptional()
  @IsString()
  coaCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  vendorId?: number;

  @IsDateString()
  incurredDate!: string;
}

export class RecordWorkOrderDowntimeDto {
  @IsDateString()
  downtimeStart!: string;

  @IsOptional()
  @IsDateString()
  downtimeEnd?: string;

  @IsString()
  cause!: string;

  @IsOptional()
  @IsString()
  operationalImpact?: string; // PARTIAL_STOP, FULL_STOP, MINOR_IMPACT
}

export class AddWorkOrderAttachmentDto {
  @IsString()
  fileUrl!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  fileId?: number;

  @IsOptional()
  @IsString()
  documentType?: string; // BEFORE_PHOTO, AFTER_PHOTO, INVOICE, BAST, REPORT, OTHER

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class VerifyWorkOrderDto {
  @IsString()
  verificationNotes!: string;

  @IsOptional()
  @IsString()
  finalAssetStatus?: string; // GOOD, FAIR, POOR, DAMAGED
}

export class CloseWorkOrderDto {
  @IsOptional()
  @IsString()
  closingNotes?: string;

  @IsOptional()
  @IsString()
  finalAssetStatus?: string; // GOOD, FAIR, POOR, DAMAGED
}

export class EvaluateCapitalizationDto {
  @IsBoolean()
  approved!: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class MaintQueryDto extends PageQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageSize?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  maintenanceType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assetId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assignedToUserId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class MaintReportQueryDto {
  @IsOptional()
  @IsString()
  reportType?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assetId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  vendorId?: number;
}
