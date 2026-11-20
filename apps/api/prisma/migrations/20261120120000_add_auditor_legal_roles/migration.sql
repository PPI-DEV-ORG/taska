-- Tambah role AUDITOR dan LEGAL ke enum database
ALTER TABLE `ApprovalStep` MODIFY `approverRole` ENUM('SUPER_ADMIN', 'ADMIN', 'BOS', 'SALES', 'PM', 'TEKNISI', 'PROCUREMENT', 'FINANCE', 'GUDANG', 'SE', 'HR', 'AUDITOR', 'LEGAL') NOT NULL;
ALTER TABLE `Notification` MODIFY `targetRole` ENUM('SUPER_ADMIN', 'ADMIN', 'BOS', 'SALES', 'PM', 'TEKNISI', 'PROCUREMENT', 'FINANCE', 'GUDANG', 'SE', 'HR', 'AUDITOR', 'LEGAL') NULL;
ALTER TABLE `User` MODIFY `role` ENUM('SUPER_ADMIN', 'ADMIN', 'BOS', 'SALES', 'PM', 'TEKNISI', 'PROCUREMENT', 'FINANCE', 'GUDANG', 'SE', 'HR', 'AUDITOR', 'LEGAL') NOT NULL;

-- Perbarui matriks peran standar ke v14
DELETE FROM `SystemSetting` WHERE `key` = 'rbac.matrixVersion' AND CAST(`value` AS UNSIGNED) < 14;
