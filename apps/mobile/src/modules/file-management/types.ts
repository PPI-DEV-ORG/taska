export type FileItem = {
  id: number;
  fileCode: string;
  originalName: string;
  displayName: string;
  extension?: string | null;
  mimeType: string;
  size: number;
  kind: "FOTO" | "DOKUMEN" | "VIDEO" | "LAINNYA";
  status: "AVAILABLE" | "UPLOADING" | "PENDING_DELETION" | "DELETED" | "ARCHIVED";
  visibility: "COMPANY" | "DEPARTMENT" | "PRIVATE" | "CONFIDENTIAL";
  checksumSha256?: string | null;
  description?: string | null;
  createdAt: string;
  deletedAt?: string | null;
  category?: { id: number; name: string; code: string } | null;
  uploader?: { id: number; name: string; role: string } | null;
  provider: { id: number; name: string; type: string };
  storageKey: string;
  subfolder?: string;
  subfolderLabel?: string;
  subfolderColor?: string;
  usedBy: Array<{
    module: string;
    moduleKey: string;
    entity: string;
    id: string | number;
    label: string;
    href?: string;
  }>;
  isOrphan: boolean;
  isAllowed: boolean;
  downloadUrl: string;
};

export type StorageProviderItem = {
  id: number;
  name: string;
  type: "LOCAL" | "S3" | "NAS_MOUNT" | "WEBDAV";
  adapterCode: string;
  config: Record<string, any>;
  source: "DB" | "ENV";
  status: "ACTIVE" | "DISABLED" | "READ_ONLY";
  isDefault: boolean;
  needsReauth: boolean;
  lastOkAt?: string | null;
  lastError?: string | null;
  uploadOk: number;
  uploadFail: number;
  fileCount: number;
  totalFiles: number;
  createdAt: string;
  health: {
    ok: boolean;
    latencyMs: number;
    message?: string;
    capacity?: { total?: number; used?: number; free?: number };
  } | null;
  hasCredentials: boolean;
};

export type FileOverview = {
  totalFiles: number;
  totalBytes: number;
  orphanFiles: number;
  orphanBytes: number;
  deletedFiles: number;
  subfolders?: Array<{
    folder: string;
    label: string;
    count: number;
    totalBytes: number;
    color: string;
    description?: string;
  }>;
  categories: Array<{ id: number; code: string; name: string; count: number }>;
  providers: Array<{ id: number; name: string; type: string; isDefault: boolean; status: string; count: number }>;
  recentFiles: FileItem[];
};

export type ServerStorage = {
  diskTotal: number;
  diskUsed: number;
  diskFree: number;
  diskUsedPercent: number;
  uploadsSizeBytes: number;
  serverPath: string;
  error?: string;
};

export type MigrationJob = {
  id: number;
  sourceProviderId: number;
  targetProviderId: number;
  mode: "MANUAL" | "SCHEDULED";
  olderThanDays?: number | null;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED" | "ROLLED_BACK";
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  cleanedFiles: number;
  error?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
};

export type MigrationSchedule = {
  id: number;
  name?: string | null;
  sourceProviderId: number;
  targetProviderId: number;
  everyDays: number;
  runAtTime: string;
  olderThanDays?: number | null;
  enabled: boolean;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  createdAt: string;
};

export type BrowseEntry = {
  name: string;
  path: string;
  type: "dir" | "file";
  size?: number;
  modifiedAt?: string;
};
