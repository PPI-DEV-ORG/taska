export type DrivePermissions = {
  canView: boolean;
  canUpload: boolean;
  canDownload: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageAccess: boolean;
};

export type DriveBreadcrumb = {
  id: number;
  name: string;
};

export type DriveFolderItem = {
  id: number;
  parentId: number | null;
  name: string;
  description?: string | null;
  color?: string | null;
  isRestricted: boolean;
  createdBy?: { id: number; name: string } | null;
  createdAt: string;
  updatedAt: string;
  subfolderCount: number;
  fileCount: number;
  permissions: DrivePermissions;
};

export type DriveFileItem = {
  id: number;
  folderId: number | null;
  folderName?: string;
  name: string;
  originalName: string;
  extension: string;
  fileType: string; // pdf | excel | word | image | video | audio | text | other
  mimeType: string;
  size: number;
  description?: string | null;
  checksumSha256?: string | null;
  uploader?: { id: number; name: string; role?: string } | null;
  provider?: { id: number; name: string; type: string } | null;
  createdAt: string;
  updatedAt: string;
  permissions: DrivePermissions;
};

export type DriveBrowseResponse = {
  currentFolder: {
    id: number;
    parentId: number | null;
    name: string;
    description?: string | null;
    color?: string | null;
    isRestricted: boolean;
    createdBy?: { id: number; name: string } | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  breadcrumbs: DriveBreadcrumb[];
  permissions: DrivePermissions;
  folders: DriveFolderItem[];
  files: DriveFileItem[];
  stats: {
    totalFolders: number;
    totalFiles: number;
    totalBytes: number;
  };
};

export type DriveTreeFolder = {
  id: number;
  parentId: number | null;
  name: string;
  isRestricted: boolean;
  color?: string | null;
  canUpload: boolean;
};

export type DrivePreviewSheet = {
  name: string;
  rows: string[][];
  totalRows: number;
  truncated: boolean;
};

export type DriveDocxBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "table"; rows: string[][] };

export type DrivePreviewPayload =
  | { kind: "image"; mimeType: string; fileName: string; size: number }
  | { kind: "pdf"; mimeType: string; fileName: string; size: number }
  | { kind: "video"; mimeType: string; fileName: string; size: number }
  | { kind: "audio"; mimeType: string; fileName: string; size: number }
  | { kind: "text"; mimeType: string; fileName: string; size: number; content: string; truncated: boolean }
  | { kind: "spreadsheet"; mimeType: string; fileName: string; size: number; sheets: DrivePreviewSheet[] }
  | { kind: "docx"; mimeType: string; fileName: string; size: number; blocks: DriveDocxBlock[] }
  | { kind: "unsupported"; mimeType: string; fileName: string; size: number; reason: string };

export type DriveAccessEntry = {
  id?: number;
  principalType: "USER" | "ROLE";
  principalId: string;
  canView: boolean;
  canUpload: boolean;
  canDownload: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type DrivePrincipals = {
  users: { id: number; name: string; email: string; role: string; department?: string | null }[];
  roles: { code: string; name: string; description: string }[];
};
