export type MaintCategory = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  _count?: { plans?: number; checklists?: number };
};

export type MaintChecklistItem = {
  id?: number;
  checklistId?: number;
  itemText: string;
  standardCondition?: string | null;
  sequence?: number;
  isRequired?: boolean;
};

export type MaintChecklist = {
  id: number;
  code: string;
  name: string;
  categoryId: number;
  category?: MaintCategory;
  description?: string | null;
  isActive: boolean;
  items?: MaintChecklistItem[];
  _count?: { plans?: number };
};

export type MaintVendor = {
  id: number;
  code: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  specialization?: string | null;
  rating?: number | null;
  isActive: boolean;
  _count?: { costs?: number };
};

export type MaintPlanAsset = {
  id: number;
  planId: number;
  assetId: number;
  asset?: {
    id: number;
    assetCode: string;
    name: string;
    brand?: string | null;
    model?: string | null;
    serialNumber?: string | null;
    location?: { id: number; name: string } | null;
    department?: string | null;
    condition?: string;
    status?: string;
  };
  lastServiceDate?: string | null;
  lastMeterReading?: number | null;
  nextServiceDate?: string | null;
  nextMeterReading?: number | null;
  status: string;
};

export type MaintPlan = {
  id: number;
  planNumber: string;
  title: string;
  categoryId: number;
  category?: MaintCategory;
  method: string; // CALENDAR_BASED, USAGE_BASED, CONDITION_BASED, MANUAL
  intervalValue: number;
  intervalUnit: string; // DAYS, WEEKS, MONTHS, YEARS, KM, HOURS
  checklistId?: number | null;
  checklist?: MaintChecklist | null;
  picUserId?: number | null;
  picUser?: { id: number; name: string; email?: string } | null;
  autoGenerate: boolean;
  generationHorizon: string; // NEXT_CYCLE, 3_MONTHS, 6_MONTHS, 1_YEAR
  reminderLeadDays: string; // e.g. "14,7,3,1"
  description?: string | null;
  isActive: boolean;
  assets?: MaintPlanAsset[];
  schedules?: MaintSchedule[];
  _count?: { schedules?: number };
  createdAt?: string;
};

export type MaintSchedule = {
  id: number;
  scheduleNumber: string;
  planId?: number | null;
  plan?: { id: number; planNumber: string; title: string; method?: string | null; checklistId?: number | null } | null;
  assetId: number;
  asset?: {
    id: number;
    assetCode: string;
    name: string;
    brand?: string | null;
    model?: string | null;
    serialNumber?: string | null;
    location?: { id: number; name: string } | null;
    department?: string | null;
    condition?: string;
  };
  scheduledDate: string;
  scheduledMeter?: number | null;
  maintenanceType: string;
  priority: string;
  assignedUserId?: number | null;
  assignedUser?: { id: number; name: string; email?: string } | null;
  status: string; // SCHEDULED, COMPLETED, OVERDUE, CANCELLED
  rescheduleReason?: string | null;
  rescheduledFromDate?: string | null;
  notes?: string | null;
  workOrders?: { id: number; workOrderNumber: string; status: string; totalCost: number }[];
  createdAt?: string;
};

export type MaintRequest = {
  id: number;
  requestNumber: string;
  assetId: number;
  asset?: {
    id: number;
    assetCode: string;
    name: string;
    brand?: string | null;
    model?: string | null;
    location?: { id: number; name: string } | null;
    department?: string | null;
    condition?: string;
  };
  reporterUserId: number;
  reporterUser?: { id: number; name: string; email?: string };
  requestDate: string;
  problemDescription: string;
  urgency: string; // LOW, MEDIUM, HIGH, CRITICAL
  initialInspectionNotes?: string | null;
  inspectedByUserId?: number | null;
  inspectedByUser?: { id: number; name: string } | null;
  inspectedAt?: string | null;
  status: string; // DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, WORK_ORDER_CREATED, CANCELLED
  rejectionReason?: string | null;
  workOrderId?: number | null;
  attachments?: MaintAttachment[];
  workOrders?: { id: number; workOrderNumber: string; status: string }[];
  createdAt?: string;
};

export type MaintWorkOrderTask = {
  id: number;
  workOrderId: number;
  taskName: string;
  instruction?: string | null;
  sequence: number;
  isCompleted: boolean;
  completedAt?: string | null;
  notes?: string | null;
};

export type MaintWorkOrderChecklist = {
  id: number;
  workOrderId: number;
  checklistItemId?: number | null;
  itemText: string;
  conditionBefore?: string | null;
  conditionAfter?: string | null;
  status: string; // PASS, FAIL, NEEDS_ATTENTION
  notes?: string | null;
};

export type MaintMaterial = {
  id: number;
  workOrderId: number;
  productId?: number | null;
  product?: { id: number; sku: string; name: string; unit: string } | null;
  sparePartName: string;
  partNumber?: string | null;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  source: string; // WAREHOUSE, DIRECT_PURCHASE
  warehouseId?: number | null;
  notes?: string | null;
};

export type MaintLabor = {
  id: number;
  workOrderId: number;
  technicianUserId?: number | null;
  technicianUser?: { id: number; name: string } | null;
  technicianName: string;
  hoursSpent: number;
  hourlyRate: number;
  laborCost: number;
  workDescription?: string | null;
  loggedDate?: string | null;
};

export type MaintCost = {
  id: number;
  workOrderId: number;
  costComponent: string; // SPARE_PART, LABOR, EXTERNAL_SERVICE, TRANSPORTATION, OTHER
  description: string;
  amount: number;
  sourceTransactionType: string; // CASH_BANK, INVOICE, WAREHOUSE, EXPENSE, MANUAL
  sourceTransactionRef?: string | null;
  isCapitalized: boolean;
  coaCode?: string | null;
  vendorId?: number | null;
  vendor?: MaintVendor | null;
  incurredDate: string;
};

export type MaintDowntime = {
  id: number;
  assetId: number;
  workOrderId?: number | null;
  downtimeStart: string;
  downtimeEnd?: string | null;
  durationHours: number;
  cause: string;
  operationalImpact?: string | null; // PARTIAL_STOP, FULL_STOP, MINOR_IMPACT
  status: string;
};

export type MaintAttachment = {
  id: number;
  workOrderId?: number | null;
  requestId?: number | null;
  fileId?: number | null;
  fileUrl: string;
  documentType: string; // BEFORE_PHOTO, AFTER_PHOTO, INVOICE, BAST, REPORT, OTHER
  title: string;
  notes?: string | null;
  createdAt?: string;
};

export type MaintWorkOrder = {
  id: number;
  workOrderNumber: string;
  assetId: number;
  asset?: {
    id: number;
    assetCode: string;
    name: string;
    brand?: string | null;
    model?: string | null;
    serialNumber?: string | null;
    location?: { id: number; name: string } | null;
    department?: string | null;
    condition?: string;
    status?: string;
  };
  maintenanceType: string; // PREVENTIVE, CORRECTIVE
  priority: string; // LOW, MEDIUM, HIGH, CRITICAL
  problemDescription: string;
  workInstruction?: string | null;
  assignedToUserId?: number | null;
  assignedToUser?: { id: number; name: string; email?: string; role?: string } | null;
  plannedStartDate?: string | null;
  plannedFinishDate?: string | null;
  actualStartDate?: string | null;
  actualFinishDate?: string | null;
  totalSparePartCost: number;
  totalLaborCost: number;
  totalExternalServiceCost: number;
  totalTransportationCost: number;
  totalOtherCost: number;
  totalCost: number;
  isCapitalized: boolean;
  capitalizationStatus?: string | null;
  workResult?: string | null;
  rootCause?: string | null;
  correctiveAction?: string | null;
  verificationNotes?: string | null;
  verifiedByUserId?: number | null;
  verifiedByUser?: { id: number; name: string } | null;
  verifiedAt?: string | null;
  closedByUserId?: number | null;
  closedByUser?: { id: number; name: string } | null;
  closedAt?: string | null;
  status: string; // DRAFT, PENDING_APPROVAL, APPROVED, ASSIGNED, IN_PROGRESS, WAITING_FOR_PARTS, WAITING_FOR_VENDOR, COMPLETED, VERIFIED, CLOSED, CANCELLED
  requestId?: number | null;
  request?: { id: number; requestNumber: string } | null;
  scheduleId?: number | null;
  schedule?: { id: number; scheduleNumber: string } | null;
  tasks?: MaintWorkOrderTask[];
  checklists?: MaintWorkOrderChecklist[];
  materials?: MaintMaterial[];
  labor?: MaintLabor[];
  costs?: MaintCost[];
  histories?: MaintHistory[];
  downtimes?: MaintDowntime[];
  attachments?: MaintAttachment[];
  _count?: { tasks?: number; checklists?: number; materials?: number; costs?: number };
  createdAt?: string;
  updatedAt?: string;
};

export type MaintHistory = {
  id: number;
  assetId: number;
  workOrderId?: number | null;
  workOrder?: { id: number; workOrderNumber: string } | null;
  maintenanceDate: string;
  maintenanceType: string;
  problemDescription: string;
  rootCause?: string | null;
  correctiveAction?: string | null;
  sparePartsSummary?: string | null;
  technicianOrVendor?: string | null;
  totalCost: number;
  assetDowntimeHours: number;
  photoBeforeUrl?: string | null;
  photoAfterUrl?: string | null;
  finalAssetStatus: string;
  createdAt?: string;
};

export type MaintDashboardKpi = {
  totalAssets: number;
  assetsNeedingMaintenance: number;
  dueCount: number;
  overdueCount: number;
  openWos: number;
  inProgressWos: number;
  completedWos: number;
  monthlyCorrectiveCount: number;
  monthlyTotalCost: number;
  pmCompliance: number;
  mttrHours: number;
  mtbfHours: number;
  totalDowntimeHours: number;
};

export type MaintDashboardData = {
  kpi: MaintDashboardKpi;
  topAssetsByCost: {
    asset: { id: number; assetCode: string; name: string; department?: string | null };
    totalCost: number;
    serviceCount: number;
  }[];
};

export type MaintLookups = {
  assets: {
    id: number;
    assetCode: string;
    name: string;
    brand?: string | null;
    model?: string | null;
    serialNumber?: string | null;
    location?: { id: number; name: string } | null;
    department?: string | null;
    condition?: string;
    status?: string;
  }[];
  categories: MaintCategory[];
  checklists: MaintChecklist[];
  vendors: MaintVendor[];
  users: { id: number; name: string; email?: string; role?: string }[];
  products: { id: number; sku: string; name: string; unit: string; purchasePrice: number }[];
};
