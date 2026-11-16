-- Hak akses peran bawaan -> matriks standar v4 (src/rbac/role-matrix.ts)
--   * Gudang tidak lagi memegang menu PO Keluar & Pengiriman Pemasok (data PO tetap terbaca untuk penerimaan);
--     barang yang dikirim tampil di Penerimaan Barang.
-- Diterapkan server saat start (SettingsService.upgradeRoleMatrix). Peran kustom tidak disentuh.
DELETE FROM `SystemSetting` WHERE `key` = 'rbac.matrixVersion' AND CAST(`value` AS UNSIGNED) < 4;
