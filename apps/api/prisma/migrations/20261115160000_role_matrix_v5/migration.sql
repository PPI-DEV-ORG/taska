-- Hak akses peran bawaan -> matriks standar v5 (src/rbac/role-matrix.ts)
--   * Gudang tanpa akses Persetujuan, Pembelian (menu), Keuangan & Proyek (menu / ringkasan).
--     Gudang tetap melihat & mengelola pengeluaran / petty cash miliknya sendiri.
--   * Persetujuan penerimaan barang cukup Procurement (Gudang mengonfirmasi fisik saat membuat penerimaan).
-- Diterapkan server saat start (SettingsService.upgradeRoleMatrix). Peran kustom tidak disentuh.
DELETE FROM `SystemSetting` WHERE `key` = 'rbac.matrixVersion' AND CAST(`value` AS UNSIGNED) < 5;
