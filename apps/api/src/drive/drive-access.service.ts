import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { can } from "../rbac/permissions.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";

export type EffectiveDrivePermissions = {
  canView: boolean;
  canUpload: boolean;
  canDownload: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageAccess: boolean;
};

@Injectable()
export class DriveAccessService {
  constructor(private readonly prisma: PrismaService) {}

  isSuperAdmin(user: RequestUser): boolean {
    const role = (user.role || "").toUpperCase().trim().replace(/[\s-]+/g, "_");
    return role === "SUPER_ADMIN" || role === "SUPERADMIN";
  }

  /**
   * Manager/Admin Dokumen Umum: boleh mengakses seluruh folder termasuk yang dibatasi & mengatur hak akses.
   */
  isDriveManager(user: RequestUser): boolean {
    if (this.isSuperAdmin(user)) return true;
    return (
      can(user.role, "generalFiles", "P") ||
      can(user.role, "generalFiles", "V") ||
      can(user.role, "fileManagement", "P") ||
      can(user.role, "fileManagement", "V")
    );
  }

  /**
   * Prinsip RBAC user: jika bisa lihat menu Dokumen Umum (atau Manajemen File), boleh melihat filenya.
   */
  canAccessDriveModule(user: RequestUser): boolean {
    if (this.isDriveManager(user)) return true;
    return (
      can(user.role, "generalFiles", "M") ||
      can(user.role, "generalFiles", "L") ||
      can(user.role, "fileManagement", "M") ||
      can(user.role, "fileManagement", "L")
    );
  }

  getBasePermissions(user: RequestUser): EffectiveDrivePermissions {
    if (this.isDriveManager(user)) {
      return {
        canView: true,
        canUpload: true,
        canDownload: true,
        canEdit: true,
        canDelete: true,
        canManageAccess: true,
      };
    }

    const canView = this.canAccessDriveModule(user);
    const canUpload =
      can(user.role, "generalFiles", "C") || can(user.role, "fileManagement", "C");
    const canDownload =
      canView ||
      can(user.role, "generalFiles", "E") ||
      can(user.role, "fileManagement", "E");
    const canEdit =
      can(user.role, "generalFiles", "U") || can(user.role, "fileManagement", "U");
    const canDelete =
      can(user.role, "generalFiles", "A") || can(user.role, "fileManagement", "A");

    return {
      canView,
      canUpload,
      canDownload,
      canEdit,
      canDelete,
      canManageAccess: false,
    };
  }

  private matchesUser(
    perm: { principalType: string; principalId: string },
    user: RequestUser,
  ): boolean {
    const normRole = (user.role || "").toUpperCase().trim().replace(/[\s-]+/g, "_");
    if (perm.principalType === "USER" && perm.principalId === String(user.id)) return true;
    if (
      perm.principalType === "ROLE" &&
      perm.principalId.toUpperCase().trim().replace(/[\s-]+/g, "_") === normRole
    ) {
      return true;
    }
    return false;
  }

  /**
   * Evaluasi hak akses efektif pada sebuah folder (termasuk inheritance pembatasan dari parent folder).
   * Jika folderId === null (root), mengembalikan hak akses dasar RBAC.
   */
  async getFolderPermissions(
    user: RequestUser,
    folderId: number | null,
  ): Promise<EffectiveDrivePermissions> {
    const base = this.getBasePermissions(user);
    if (this.isDriveManager(user) || folderId === null) {
      return base;
    }

    // Kumpulkan rantai ancestor dari root ke folder target
    const chain: Array<{
      id: number;
      parentId: number | null;
      isRestricted: boolean;
      createdById: number | null;
      permissions: Array<{
        principalType: string;
        principalId: string;
        canView: boolean;
        canUpload: boolean;
        canDownload: boolean;
        canEdit: boolean;
        canDelete: boolean;
      }>;
    }> = [];

    let cursor: number | null = folderId;
    const visited = new Set<number>();
    while (cursor !== null && !visited.has(cursor) && chain.length < 25) {
      visited.add(cursor);
      const row: {
        id: number;
        parentId: number | null;
        isRestricted: boolean;
        createdById: number | null;
        permissions: Array<{
          principalType: string;
          principalId: string;
          canView: boolean;
          canUpload: boolean;
          canDownload: boolean;
          canEdit: boolean;
          canDelete: boolean;
        }>;
      } | null = await this.prisma.main.driveFolder.findUnique({
        where: { id: cursor },
        select: {
          id: true,
          parentId: true,
          isRestricted: true,
          createdById: true,
          permissions: {
            select: {
              principalType: true,
              principalId: true,
              canView: true,
              canUpload: true,
              canDownload: true,
              canEdit: true,
              canDelete: true,
            },
          },
        },
      });
      if (!row) break;
      chain.unshift(row);
      cursor = row.parentId;
    }

    let effective: EffectiveDrivePermissions = { ...base };

    for (let i = 0; i < chain.length; i++) {
      const node = chain[i]!;
      const isTarget = i === chain.length - 1;
      const isOwner = node.createdById === user.id;
      const matched = node.permissions.filter((p) => this.matchesUser(p, user));

      if (node.isRestricted) {
        // Pembuat folder selalu memiliki akses penuh & boleh mengatur hak akses foldernya sendiri
        if (isOwner) {
          effective = {
            canView: true,
            canUpload: true,
            canDownload: true,
            canEdit: true,
            canDelete: true,
            canManageAccess: isTarget ? true : effective.canManageAccess,
          };
          continue;
        }
        if (matched.length === 0) {
          return {
            canView: false,
            canUpload: false,
            canDownload: false,
            canEdit: false,
            canDelete: false,
            canManageAccess: false,
          };
        }
        const aclView = matched.some((m) => m.canView);
        if (!aclView) {
          return {
            canView: false,
            canUpload: false,
            canDownload: false,
            canEdit: false,
            canDelete: false,
            canManageAccess: false,
          };
        }
        effective = {
          canView: true,
          canUpload: matched.some((m) => m.canUpload),
          canDownload: matched.some((m) => m.canDownload),
          canEdit: matched.some((m) => m.canEdit),
          canDelete: matched.some((m) => m.canDelete),
          canManageAccess: false,
        };
      } else {
        if (isOwner && isTarget) {
          effective = {
            ...effective,
            canView: true,
            canUpload: true,
            canDownload: true,
            canEdit: true,
            canDelete: true,
            canManageAccess: true,
          };
        } else if (matched.length > 0) {
          // Folder tidak dibatasi, tapi ada ACL eksplisit tambahan (grant)
          effective = {
            canView: effective.canView || matched.some((m) => m.canView),
            canUpload: effective.canUpload || matched.some((m) => m.canUpload),
            canDownload: effective.canDownload || matched.some((m) => m.canDownload),
            canEdit: effective.canEdit || matched.some((m) => m.canEdit),
            canDelete: effective.canDelete || matched.some((m) => m.canDelete),
            canManageAccess: effective.canManageAccess,
          };
        }
      }
    }

    return effective;
  }

  /**
   * Evaluasi hak akses efektif pada sebuah file (inheritance folder + ACL file jika ada).
   */
  async getFilePermissions(
    user: RequestUser,
    fileId: number,
  ): Promise<EffectiveDrivePermissions> {
    if (this.isDriveManager(user)) {
      return this.getBasePermissions(user);
    }

    const file = await this.prisma.main.driveFile.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        folderId: true,
        uploadedById: true,
        permissions: {
          select: {
            principalType: true,
            principalId: true,
            canView: true,
            canUpload: true,
            canDownload: true,
            canEdit: true,
            canDelete: true,
          },
        },
      },
    });
    if (!file) {
      return {
        canView: false,
        canUpload: false,
        canDownload: false,
        canEdit: false,
        canDelete: false,
        canManageAccess: false,
      };
    }

    const folderPerms = await this.getFolderPermissions(user, file.folderId);
    const matched = file.permissions.filter((p) => this.matchesUser(p, user));

    if (matched.length > 0) {
      return {
        canView: folderPerms.canView || matched.some((m) => m.canView),
        canUpload: folderPerms.canUpload || matched.some((m) => m.canUpload),
        canDownload: folderPerms.canDownload || matched.some((m) => m.canDownload),
        canEdit: folderPerms.canEdit || matched.some((m) => m.canEdit),
        canDelete: folderPerms.canDelete || matched.some((m) => m.canDelete),
        canManageAccess: folderPerms.canManageAccess,
      };
    }

    return folderPerms;
  }
}
