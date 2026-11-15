-- Semua biaya langsung project (operasional lapangan, petty cash project, jasa vendor project, dan biaya survey
-- prospek yang menjadi project) dibukukan sebagai HPP project, bukan beban operasional kantor.
-- Jurnal lama direklasifikasi otomatis oleh server (ProjectCostService, sekali jalan) setelah akun ini ada.
INSERT INTO `CoaAccount` (`code`, `name`, `category`, `normalBalance`, `parentCode`, `isPostable`, `isCash`, `isSystem`, `status`, `createdAt`, `updatedAt`)
SELECT '5103', 'HPP Biaya Langsung Project', 'Beban Pokok (HPP)', 'DEBIT',
       (SELECT `code` FROM (SELECT `code` FROM `CoaAccount` WHERE `code` = '5000') AS p),
       true, false, true, 'AKTIF', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM (SELECT `code` FROM `CoaAccount` WHERE `code` = '5103') AS x);

INSERT INTO `AccountMapping` (`key`, `accountCode`, `updatedAt`)
SELECT 'PROJECT_DIRECT_COST', '5103', CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM (SELECT `key` FROM `AccountMapping` WHERE `key` = 'PROJECT_DIRECT_COST') AS x);
