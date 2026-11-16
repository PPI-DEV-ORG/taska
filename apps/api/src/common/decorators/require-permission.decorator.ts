import { SetMetadata } from "@nestjs/common";
import type { Action, ModuleKey } from "../../rbac/permissions.js";

export const PERMISSION_KEY = "permission";

export type PermissionMeta = {
  module: ModuleKey;
  action: Action;
};

/** Tandai endpoint dengan modul + aksi RBAC (dicek PermissionsGuard). */
export const Require = (module: ModuleKey, action: Action) =>
  SetMetadata(PERMISSION_KEY, { module, action } satisfies PermissionMeta);

/**
 * Endpoint boleh dipakai semua pengguna yang sudah login, walau controller-nya diberi @Require.
 * (Metadata null menimpa @Require di tingkat class.) Pakai hanya untuk data non-sensitif, mis. daftar nama akun.
 */
export const AnyLoggedInUser = () => SetMetadata(PERMISSION_KEY, null);
