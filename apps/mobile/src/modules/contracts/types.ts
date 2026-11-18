export type CtrType = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  isSystem: boolean;
  _count?: { contracts: number };
};

export type CtrParty = {
  id?: number;
  contractId?: number;
  partyType: string;
  entityType: string;
  entityId?: number | null;
  name: string;
  role?: string | null;
  address?: string | null;
  picName?: string | null;
  picEmail?: string | null;
  picPhone?: string | null;
};

export type CtrDocumentVersion = {
  id: number;
  documentId: number;
  versionNumber: number;
  fileId?: number | null;
  fileUrl?: string | null;
  fileName: string;
  fileSize?: number | null;
  mimeType?: string | null;
  changeSummary?: string | null;
  isLockedForApproval: boolean;
  uploadedById?: number | null;
  uploadedByUser?: { id: number; name: string; role?: string } | null;
  createdAt: string;
};

export type CtrDocument = {
  id: number;
  contractId: number;
  documentCategory: string;
  documentTitle: string;
  documentNumber?: string | null;
  isConfidential: boolean;
  restricted?: boolean;
  signedDate?: string | null;
  signedByFirstParty?: string | null;
  signedBySecondParty?: string | null;
  currentVersionNumber: number;
  versions?: CtrDocumentVersion[];
  createdAt: string;
};

export type CtrService = {
  id?: number;
  contractId?: number;
  serviceName: string;
  serviceScope?: string | null;
  servicePeriod?: string | null;
  serviceLocation?: string | null;
  supportContact?: string | null;
  serviceFee?: number | null;
  penaltyClause?: string | null;
  renewalTerms?: string | null;
};

export type CtrSla = {
  id?: number;
  contractId?: number;
  serviceId?: number | null;
  indicatorName: string;
  targetMetric: string;
  responseHours?: number | null;
  resolutionHours?: number | null;
  penaltyDetails?: string | null;
  operationalHours?: string | null;
};

export type CtrTerm = {
  id?: number;
  contractId?: number;
  termType: string;
  clauseNumber?: string | null;
  title: string;
  content: string;
};

export type CtrFinancial = {
  id?: number;
  contractId?: number;
  valueType: string;
  currency: string;
  baseAmount: number;
  taxPercentage: number;
  taxAmount: number;
  totalAmount: number;
  downPaymentAmount: number;
  retentionAmount: number;
  retentionPeriodDays?: number | null;
  penaltyTerms?: string | null;
  costCenter?: string | null;
  projectReference?: string | null;
  notes?: string | null;
};

export type CtrPaymentSchedule = {
  id?: number;
  contractId?: number;
  scheduleNumber: number;
  milestoneName: string;
  dueDate: string;
  amount: number;
  taxAmount?: number;
  totalAmount: number;
  paymentStatus: string;
  invoiceReference?: string | null;
  paidDate?: string | null;
  notes?: string | null;
};

export type CtrRenewal = {
  id: number;
  contractId: number;
  renewalNumber: number;
  renewalCode: string;
  submissionDate: string;
  proposedEffectiveDate: string;
  proposedExpirationDate: string;
  previousValue: number;
  proposedValue: number;
  reason: string;
  status: string;
  submittedById?: number | null;
  submittedByUser?: { id: number; name: string } | null;
  reviewedById?: number | null;
  reviewedByUser?: { id: number; name: string } | null;
  reviewedAt?: string | null;
  reviewComments?: string | null;
  draftAddendumDocId?: number | null;
  createdAt: string;
};

export type CtrApproval = {
  id: number;
  contractId: number;
  stage: string;
  sequence: number;
  status: string;
  approverId?: number | null;
  approverUser?: { id: number; name: string; role?: string } | null;
  approverRole?: string | null;
  decisionTimestamp?: string | null;
  comments?: string | null;
  approvedDocumentVersionId?: number | null;
  createdAt: string;
};

export type CtrAmendment = {
  id: number;
  contractId: number;
  amendmentNumber: string;
  amendmentDate: string;
  title: string;
  description: string;
  valueAdjustment: number;
  newEffectiveDate?: string | null;
  newExpirationDate?: string | null;
  documentId?: number | null;
  approvedById?: number | null;
  approvedByUser?: { id: number; name: string } | null;
  createdAt: string;
};

export type CtrTermination = {
  id: number;
  contractId: number;
  terminationDate: string;
  reason: string;
  penaltyAmount: number;
  remainingObligations?: string | null;
  checklistConfirmed: boolean;
  beritaAcaraDocId?: number | null;
  approvedById?: number | null;
  approvedByUser?: { id: number; name: string } | null;
  status: string;
  createdAt: string;
};

export type CtrRelation = {
  id: number;
  contractId: number;
  relatedModule: string;
  relatedId: number;
  referenceCode?: string | null;
  notes?: string | null;
  createdAt: string;
};

export type CtrAuditLog = {
  id: number;
  contractId: number;
  action: string;
  userId?: number | null;
  userName?: string | null;
  actorUser?: { id: number; name: string; role?: string } | null;
  fieldChanged?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  notes?: string | null;
  createdAt: string;
};

export type CtrContract = {
  id: number;
  contractNumber: string;
  officialNumber?: string | null;
  title: string;
  typeId: number;
  type?: CtrType;
  typeName?: string;
  typeCode?: string;
  counterpartyType: string;
  counterpartyId?: number | null;
  counterpartyName: string;
  effectiveDate: string;
  expirationDate: string;
  renewalDate?: string | null;
  isAutoRenewal: boolean;
  currency: string;
  contractValue: number;
  contractOwnerId?: number | null;
  ownerUser?: { id: number; name: string; email?: string; role?: string } | null;
  department: string;
  paymentTerms?: string | null;
  paymentFrequency: string;
  status: string;
  approvalStatus: string;
  description?: string | null;
  daysToExpiration?: number | null;
  daysToRenewal?: number | null;
  paidCommitment?: number;
  remainingCommitment?: number;
  canAccessConfidential?: boolean;
  parties?: CtrParty[];
  documents?: CtrDocument[];
  services?: CtrService[];
  slas?: CtrSla[];
  terms?: CtrTerm[];
  financial?: CtrFinancial | null;
  paymentSchedules?: CtrPaymentSchedule[];
  renewals?: CtrRenewal[];
  approvals?: CtrApproval[];
  amendments?: CtrAmendment[];
  termination?: CtrTermination | null;
  relations?: CtrRelation[];
  auditLogs?: CtrAuditLog[];
  _count?: {
    documents?: number;
    services?: number;
    slas?: number;
    paymentSchedules?: number;
    renewals?: number;
    amendments?: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type ContractDashboard = {
  summary: {
    totalContracts: number;
    activeContracts: number;
    expiringSoonContracts: number;
    expiredContracts: number;
    pendingApprovalContracts: number;
    pendingRenewalContracts: number;
    terminatedContracts: number;
    totalActiveValue: number;
    totalFinancialCommitment: number;
  };
  byCategory: Array<{ category: string; count: number; totalValue: number }>;
  byVendor: Array<{ counterparty: string; type: string; count: number; totalValue: number }>;
  byDepartment: Array<{ department: string; count: number; totalValue: number }>;
  upcomingExpirations: CtrContract[];
  pendingApprovalsList: CtrContract[];
  upcomingPayments: Array<
    CtrPaymentSchedule & {
      contractId: number;
      contractNumber: string;
      contractTitle: string;
      counterpartyName: string;
      daysUntilDue: number;
    }
  >;
};

export type ContractMasterLookups = {
  types: CtrType[];
  suppliers: Array<{ id: number; code: string; name: string; contactName?: string; phone?: string; email?: string; address?: string }>;
  customers: Array<{ id: number; code: string; name: string; company?: string; contactName?: string; phone?: string; email?: string; address?: string }>;
  projects: Array<{ id: number; number: string; name: string; status: string }>;
  subscriptions: Array<{ id: number; subscriptionCode: string; serviceName: string; providerName?: string; status: string }>;
  assets: Array<{ id: number; assetCode: string; name: string; status: string }>;
  supplierPos: Array<{ id: number; number: string; status: string; supplier?: { name: string } }>;
  users: Array<{ id: number; name: string; email?: string; role: string; department?: string; position?: string }>;
  expirationRules: Array<{ id: number; daysOffset: number; label: string; targetRole?: string }>;
};

export type ContractReportResponse = {
  reportType: string;
  title: string;
  totalRows: number;
  totalValue: number;
  rows: Record<string, any>[];
};
