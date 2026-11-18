export type AssetType = "TANGIBLE" | "INTANGIBLE";

export type AssetCondition = "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "BROKEN";

export type AssetStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "REGISTERED"
  | "IN_SERVICE"
  | "ASSIGNED"
  | "UNDER_MAINTENANCE"
  | "IDLE"
  | "DAMAGED"
  | "DISPOSED"
  | "WRITTEN_OFF";

export type DepreciationMethod = "STRAIGHT_LINE" | "DECLINING_BALANCE" | "NONE";

export type FaCategory = {
  id: number;
  code: string;
  name: string;
  type: AssetType;
  defaultUsefulLifeMonths: number;
  depreciationMethod: DepreciationMethod;
  defaultResidualRate: number;
  assetAccountCode?: string;
  accumDepAccountCode?: string;
  depExpenseAccountCode?: string;
  capitalizationThreshold: number;
  description?: string;
  _count?: { assets: number };
};

export type FaLocation = {
  id: number;
  code: string;
  name: string;
  building?: string;
  floor?: string;
  room?: string;
  description?: string;
  _count?: { assets: number };
};

export type FaAsset = {
  id: number;
  assetCode: string;
  name: string;
  categoryId: number;
  category?: FaCategory;
  type: AssetType;
  description?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  acquisitionDate: string;
  inServiceDate: string;
  acquisitionCost: number;
  residualValue: number;
  usefulLifeMonths: number;
  depreciationMethod: DepreciationMethod;
  accumulatedDepreciation: number;
  bookValue: number;
  locationId?: number;
  location?: FaLocation;
  department?: string;
  assignedUserId?: number;
  assignedUser?: {
    id: number;
    name: string;
    email: string;
    phone?: string;
    department?: string;
    position?: string;
  };
  warrantyExpiry?: string;
  condition: AssetCondition;
  status: AssetStatus;
  photoUrl?: string;
  documentUrl?: string;
  qrCodeKey?: string;
  acquisitionSource: string;
  receivingId?: number;
  purchaseRequestId?: number;
  customFields?: string;
  assignments?: FaAssignment[];
  transfers?: FaTransfer[];
  disposals?: FaDisposal[];
  depreciationSchedules?: FaDepreciationSchedule[];
  amortizationSchedules?: FaAmortizationSchedule[];
  maintenanceRefs?: any[];
  documents?: any[];
  ledgerEntries?: any[];
};

export type FaAssignment = {
  id: number;
  code: string;
  assetId: number;
  assignedToUserId?: number;
  assignedToUser?: { id: number; name: string; department?: string };
  department?: string;
  locationId?: number;
  assignmentDate: string;
  conditionAtHandover: AssetCondition;
  handoverDocumentUrl?: string;
  notes?: string;
  status: "ACTIVE" | "RETURNED";
  returnDate?: string;
  returnCondition?: string;
  createdAt: string;
};

export type FaTransfer = {
  id: number;
  code: string;
  assetId: number;
  fromUserId?: number;
  toUserId?: number;
  fromLocationId?: number;
  toLocationId?: number;
  fromDepartment?: string;
  toDepartment?: string;
  transferDate: string;
  status: string;
  reason?: string;
  condition: AssetCondition;
  createdAt: string;
};

export type FaDisposal = {
  id: number;
  code: string;
  assetId: number;
  disposalDate: string;
  disposalType: string;
  disposalPrice: number;
  costAtDisposal: number;
  accumDepAtDisposal: number;
  bookValueAtDisposal: number;
  gainLossAmount: number;
  buyerName?: string;
  reason: string;
  documentUrl?: string;
  journalEntryId?: number;
  status: string;
  createdAt: string;
};

export type FaDepreciationSchedule = {
  id: number;
  assetId: number;
  periodYear: number;
  periodMonth: number;
  monthIndex: number;
  depreciationAmount: number;
  accumulatedDepreciation: number;
  endingBookValue: number;
  isPosted: boolean;
  journalEntryId?: number;
  postedAt?: string;
};

export type FaAmortizationSchedule = {
  id: number;
  assetId: number;
  periodYear: number;
  periodMonth: number;
  monthIndex: number;
  amortizationAmount: number;
  accumulatedAmortization: number;
  endingBookValue: number;
  isPosted: boolean;
  journalEntryId?: number;
  postedAt?: string;
};

export type FaAudit = {
  id: number;
  code: string;
  auditDate: string;
  title: string;
  department?: string;
  locationId?: number;
  status: "DRAFT" | "IN_PROGRESS" | "COMPLETED";
  totalAssets: number;
  verifiedAssets: number;
  discrepancyAssets: number;
  notes?: string;
  createdAt: string;
  items?: FaAuditItem[];
};

export type FaAuditItem = {
  id: number;
  auditId: number;
  assetId: number;
  asset?: FaAsset;
  expectedLocationId?: number;
  actualLocationId?: number;
  expectedUserId?: number;
  actualUserId?: number;
  expectedCondition?: string;
  actualCondition?: string;
  scanStatus:
    | "PENDING"
    | "VERIFIED"
    | "NOT_FOUND"
    | "DAMAGED"
    | "MOVED"
    | "UNASSIGNED"
    | "NEEDS_INVESTIGATION";
  scannedAt?: string;
  notes?: string;
  photoUrl?: string;
};

export const CONDITION_COLORS: Record<AssetCondition, { bg: string; text: string; label: string }> = {
  EXCELLENT: { bg: "#DCFCE7", text: "#15803D", label: "Sangat Baik (A)" },
  GOOD: { bg: "#E0F2FE", text: "#0369A1", label: "Baik (B)" },
  FAIR: { bg: "#FEF9C3", text: "#A16207", label: "Cukup (C)" },
  POOR: { bg: "#FFEDD5", text: "#C2410C", label: "Kurang (D)" },
  BROKEN: { bg: "#FEE2E2", text: "#B91C1C", label: "Rusak (E)" },
};

export const STATUS_COLORS: Record<AssetStatus, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: "#F3F4F6", text: "#4B5563", label: "Draft" },
  PENDING_APPROVAL: { bg: "#FEF3C7", text: "#D97706", label: "Menunggu Approval" },
  REGISTERED: { bg: "#E0E7FF", text: "#4338CA", label: "Terdaftar" },
  IN_SERVICE: { bg: "#DCFCE7", text: "#15803D", label: "Siap Digunakan" },
  ASSIGNED: { bg: "#DBEAFE", text: "#1D4ED8", label: "Sedang Digunakan" },
  UNDER_MAINTENANCE: { bg: "#FFEDD5", text: "#C2410C", label: "Dalam Perbaikan" },
  IDLE: { bg: "#F3F4F6", text: "#6B7280", label: "Tidak Digunakan (Idle)" },
  DAMAGED: { bg: "#FEE2E2", text: "#B91C1C", label: "Rusak" },
  DISPOSED: { bg: "#F1F5F9", text: "#64748B", label: "Sudah Dilepas" },
  WRITTEN_OFF: { bg: "#F1F5F9", text: "#475569", label: "Dihapuskan" },
};
