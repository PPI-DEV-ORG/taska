-- Hak akses peran bawaan -> matriks standar v6 (src/rbac/role-matrix.ts)
--   * PM tidak lagi punya hak "P" (lihat harga) di Proyek & Barang: harga jual, nilai kontrak, faktur
--     & laba-rugi project hanya untuk Finance / pimpinan. PM tetap melihat isi pekerjaan (BOQ tanpa harga)
--     dan biaya operasional project yang dikelolanya.
-- Diterapkan server saat start (SettingsService.upgradeRoleMatrix). Peran kustom tidak disentuh.
DELETE FROM `SystemSetting` WHERE `key` = 'rbac.matrixVersion' AND CAST(`value` AS UNSIGNED) < 6;
