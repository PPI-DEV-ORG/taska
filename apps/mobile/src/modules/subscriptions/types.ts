export type SubCategory = {
  id: number;
  code: string;
  name: string;
  subcategory?: string | null;
  defaultBillingCycle: string;
  expenseAccountCode: string;
  prepaidAccountCode: string;
  isActive: boolean;
  _count?: { subscriptions: number };
};

export type SubProvider = {
  id: number;
  code: string;
  name: string;
  website?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  loginPortalUrl?: string | null;
  accountRepresentative?: string | null;
  isSeeded?: boolean;
  _count?: { subscriptions: number };
};

export type CostAllocation = {
  id?: number;
  department: string;
  projectId?: number | null;
  percentage: number;
  allocatedAmount: number;
};

export type SubRenewalHistory = {
  id: number;
  renewalCode: string;
  previousPeriodStart: string;
  previousPeriodEnd: string;
  newPeriodStart: string;
  newPeriodEnd: string;
  previousCost: number;
  renewalCost: number;
  invoiceNumber?: string | null;
  approvalStatus: string;
  approvedByUserId?: number | null;
  approvedByUser?: { id: number; name: string } | null;
  approvedAt?: string | null;
  notes?: string | null;
  createdAt: string;
};

export type SubPriceHistory = {
  id: number;
  changeType: string;
  previousPlan?: string | null;
  newPlan: string;
  previousCost: number;
  newCost: number;
  effectiveDate: string;
  changeReason: string;
  approvedByUser?: { id: number; name: string } | null;
  createdAt: string;
};

export type SubUsageRecord = {
  id: number;
  usersCount?: number | null;
  licensesCount?: number | null;
  storageCapacity?: string | null;
  serverSpecs?: string | null;
  utilizationStatus: string;
  evaluationNotes?: string | null;
  lastReviewedDate?: string | null;
  reviewedByUser?: { id: number; name: string } | null;
  createdAt: string;
};

export type SubPaymentRecord = {
  id: number;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  paymentDate?: string | null;
  billingPeriod?: string | null;
  amount: number;
  tax: number;
  currency: string;
  paymentStatus: string;
  financeJournalId?: number | null;
  paymentProofUrl?: string | null;
  notes?: string | null;
  createdByUser?: { id: number; name: string } | null;
  createdAt: string;
};

export type SubPrepaidSchedule = {
  id: number;
  periodYear: number;
  periodMonth: number;
  allocationDate: string;
  amount: number;
  isPosted: boolean;
  journalNumber?: string | null;
  journalEntryId?: number | null;
  postedAt?: string | null;
  createdAt: string;
};

export type SubBillingSchedule = {
  id: number;
  dueDate: string;
  periodLabel?: string | null;
  amount: number;
  status: string;
  journalEntryId?: number | null;
  confirmedAt?: string | null;
  createdAt: string;
  subscription?: SubSubscription;
};

export type SubCancellationRequest = {
  id: number;
  cancellationCode: string;
  reason: string;
  requestedByUserId: number;
  effectiveCancellationDate: string;
  finalBillingDate?: string | null;
  isDataBackupConfirmed: boolean;
  isServiceMigrationConfirmed: boolean;
  isDnsMigrationConfirmed: boolean;
  isDependencyCheckConfirmed: boolean;
  isHandoverConfirmed: boolean;
  isTerminationConfirmed: boolean;
  approvedByUserId?: number | null;
  status: string;
  notes?: string | null;
  approvedAt?: string | null;
  executedAt?: string | null;
  createdAt: string;
  requestedByUser?: { id: number; name: string } | null;
  approvedByUser?: { id: number; name: string } | null;
};

export type SubDocument = {
  id: number;
  title: string;
  documentType: string;
  fileUrl: string;
  fileSize?: number | null;
  mimeType?: string | null;
  uploadedByUser?: { id: number; name: string } | null;
  createdAt: string;
};

export type SubReminderLog = {
  id: number;
  reminderType: string;
  recipientUserId?: number | null;
  message: string;
  channel: string;
  sentAt: string;
};

export type SubSubscription = {
  id: number;
  subscriptionCode: string;
  serviceName: string;
  categoryId: number;
  category?: SubCategory | null;
  categoryName?: string | null;
  providerId?: number | null;
  provider?: SubProvider | null;
  providerName?: string | null;
  providerLabel?: string | null;
  accountIdentifier?: string | null;
  serviceUrl?: string | null;
  subscriptionPlan?: string | null;
  billingCycle: string;
  startDate: string;
  expirationDate?: string | null;
  nextRenewalDate?: string | null;
  autoRenewal: boolean;
  currency: string;
  cost: number;
  tax: number;
  originalCurrency?: string | null;
  originalAmount?: number | null;
  exchangeRate?: number | null;
  exchangeRateDate?: string | null;
  idrEquivalent?: number | null;
  mrc: number;
  arc: number;
  department: string;
  picUserId?: number | null;
  picUser?: { id: number; name: string; email?: string; department?: string | null; position?: string | null; role?: string } | null;
  businessPurpose: string;
  status: string;
  paymentStatus: string;
  expenseAccountCode?: string | null;
  prepaidAccountCode?: string | null;
  notes?: string | null;
  createdById?: number | null;
  createdAt: string;
  updatedAt: string;
  daysToRenewal?: number | null;
  allocations?: CostAllocation[];
  renewalHistory?: SubRenewalHistory[];
  priceHistory?: SubPriceHistory[];
  usageRecords?: SubUsageRecord[];
  paymentRecords?: SubPaymentRecord[];
  prepaidSchedules?: SubPrepaidSchedule[];
  billingSchedules?: SubBillingSchedule[];
  cancellationRequests?: SubCancellationRequest[];
  documents?: SubDocument[];
  reminderLogs?: SubReminderLog[];
  _count?: {
    paymentRecords?: number;
    renewalHistory?: number;
    documents?: number;
    prepaidSchedules?: number;
  };
};

export type SubscriptionDashboard = {
  overview: {
    totalActiveSubscriptions: number;
    totalMonthlyRecurringCost: number;
    totalAnnualRecurringCost: number;
    upcomingRenewals: number;
    overduePayments: number;
    expiredSubscriptions: number;
    pendingCancellation: number;
    underReview: number;
  };
  breakdowns: {
    byCategory: Array<{ name: string; count: number; mrc: number }>;
    byProvider: Array<{ name: string; count: number; mrc: number }>;
    byDepartment: Array<{ name: string; count: number; mrc: number }>;
  };
  upcomingRenewals: SubSubscription[];
  recentPayments: SubPaymentRecord[];
};

export type SubscriptionReport = {
  type: string;
  generatedAt: string;
  columns: Array<{ key: string; label: string; type?: string }>;
  rows: Record<string, any>[];
  summary: Record<string, any>;
};

export type SubscriptionListResponse = {
  items: SubSubscription[];
  data?: SubSubscription[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
};
