-- Hak akses peran bawaan -> matriks standar v3 (src/rbac/role-matrix.ts)
--   * Laporan keuangan / buku besar hanya Finance, Bos & Super Admin (Admin tidak lagi)
--   * Kelola absensi & gaji hanya HR & Finance
--   * Menu Laporan peran lain hanya laporan operasional bidangnya; HR tanpa menu Laporan
--   * Gudang tanpa harga beli / laba; PM tanpa menu Prospek & Penawaran
--
-- Hak akses disimpan sebagai JSON di SystemSetting 'rbac.roles'. Isinya diterapkan oleh server saat start
-- (SettingsService.upgradeRoleMatrix) dari matriks di kode, supaya tidak ada salinan matriks kedua di SQL.
-- Migration ini menghapus penanda versi lama sehingga penerapan itu pasti berjalan sekali. Peran kustom tidak disentuh.
DELETE FROM `SystemSetting` WHERE `key` = 'rbac.matrixVersion' AND CAST(`value` AS UNSIGNED) < 3;
